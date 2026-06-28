BEGIN;

CREATE OR REPLACE FUNCTION public.replace_super_import_skipped_card_v1(
  _batch_id uuid,
  _item_path text,
  _card jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_card_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT i.entity_id
  INTO v_card_id
  FROM public.global_import_items i
  WHERE i.batch_id = _batch_id
    AND i.user_id = v_uid
    AND i.entity_type = 'card'
    AND i.action = 'skipped'
    AND i.item_path = _item_path
    AND i.entity_id IS NOT NULL
  ORDER BY i.id DESC
  LIMIT 1;

  IF v_card_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.global_import_items i
    WHERE i.batch_id = _batch_id
      AND i.user_id = v_uid
      AND i.entity_type = 'card'
      AND i.action = 'updated'
      AND i.item_path = _item_path || '.$replace'
  ) THEN
    INSERT INTO public.global_import_items(
      batch_id, user_id, entity_type, entity_id, action, item_path, metadata
    )
    SELECT
      _batch_id, v_uid, 'card', f.id, 'updated',
      _item_path || '.$replace', to_jsonb(f)
    FROM public.flashcards f
    WHERE f.id = v_card_id
      AND f.user_id = v_uid;
  END IF;

  UPDATE public.flashcards
  SET term = BTRIM(_card->>'front'),
      translation = BTRIM(_card->>'back'),
      hint = NULLIF(BTRIM(_card->>'hint'), ''),
      context_tag = NULLIF(BTRIM(_card->>'context_tag'), ''),
      example_text = NULLIF(BTRIM(_card->>'example'), ''),
      example_translation = NULLIF(BTRIM(_card->>'example_translation'), ''),
      detailed_explanation = NULLIF(BTRIM(_card->>'detailed_explanation'), ''),
      usage_notes = NULLIF(BTRIM(_card->>'usage_notes'), ''),
      common_mistakes = NULLIF(BTRIM(_card->>'common_mistakes'), ''),
      short_explanation = NULLIF(BTRIM(_card->>'short_observation'), ''),
      word_hints = public.smart_word_hints_for_db_v2(_card->'word_hints'),
      accepted_answers_en = CASE
        WHEN NULLIF(BTRIM(_card->>'short_observation'), '') IS NULL
          THEN ARRAY[]::text[]
        ELSE ARRAY[BTRIM(_card->>'short_observation')]
      END,
      updated_at = now()
  WHERE id = v_card_id
    AND user_id = v_uid;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_super_import_duplicate_replacements_v1(
  _batch_id uuid,
  _payload jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_folder record;
  v_list record;
  v_card record;
  v_layer record;
  v_card_path text;
  v_layer_path text;
  v_updated integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.global_import_batches b
    WHERE b.id = _batch_id AND b.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Lote de importação inválido.' USING ERRCODE = '42501';
  END IF;

  FOR v_folder IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_payload #> '{package,folders}') WITH ORDINALITY
  LOOP
    FOR v_list IN
      SELECT value, ordinality
      FROM jsonb_array_elements(v_folder.value->'lists') WITH ORDINALITY
    LOOP
      FOR v_card IN
        SELECT value, ordinality
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(v_list.value->'cards') = 'array'
            THEN v_list.value->'cards' ELSE '[]'::jsonb END
        ) WITH ORDINALITY
      LOOP
        v_card_path := format(
          'package.folders[%s].lists[%s].cards[%s]',
          v_folder.ordinality - 1,
          v_list.ordinality - 1,
          v_card.ordinality - 1
        );

        IF COALESCE(v_card.value->>'type', 'normal') = 'layered' THEN
          FOR v_layer IN
            SELECT value, ordinality
            FROM jsonb_array_elements(v_card.value->'layers') WITH ORDINALITY
          LOOP
            v_layer_path := format('%s.layers[%s]', v_card_path, v_layer.ordinality - 1);
            IF public.replace_super_import_skipped_card_v1(
              _batch_id, v_layer_path, v_layer.value
            ) THEN
              v_updated := v_updated + 1;
            END IF;
          END LOOP;
        ELSE
          IF public.replace_super_import_skipped_card_v1(
            _batch_id, v_card_path, v_card.value
          ) THEN
            v_updated := v_updated + 1;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_v3(
  _request_id uuid,
  _payload jsonb,
  _destination_plan jsonb,
  _card_conflict text DEFAULT 'skip',
  _institution_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.global_import_batches%ROWTYPE;
  v_report jsonb;
  v_updated integer := 0;
  v_remaining_skipped integer := 0;
BEGIN
  IF _card_conflict NOT IN ('skip', 'copy', 'error', 'replace') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;

  IF _card_conflict <> 'replace' THEN
    RETURN public.import_app_piteco_super_package_v2(
      _request_id, _payload, _destination_plan, _card_conflict, _institution_id
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.global_import_batches
  WHERE user_id = v_uid AND request_id = _request_id;

  IF FOUND THEN
    IF v_existing.options->>'requested_card_conflict' = 'replace' THEN
      RETURN v_existing.summary || jsonb_build_object(
        'batch_id', v_existing.id,
        'request_id', v_existing.request_id,
        'status', v_existing.status
      );
    END IF;
    RAISE EXCEPTION 'request_id já usado com outra política de duplicata.';
  END IF;

  v_report := public.import_app_piteco_super_package_v2(
    _request_id, _payload, _destination_plan, 'skip', _institution_id
  );

  v_updated := public.apply_super_import_duplicate_replacements_v1(
    (v_report->>'batch_id')::uuid,
    _payload
  );
  v_remaining_skipped := GREATEST(
    COALESCE((v_report->>'cards_skipped')::integer, 0) - v_updated,
    0
  );
  v_report := v_report || jsonb_build_object(
    'cards_updated', v_updated,
    'cards_skipped', v_remaining_skipped
  );

  UPDATE public.global_import_batches
  SET summary = v_report,
      options = COALESCE(options, '{}'::jsonb) || jsonb_build_object(
        'card_conflict', 'replace',
        'requested_card_conflict', 'replace'
      )
  WHERE id = (v_report->>'batch_id')::uuid
    AND user_id = v_uid;

  RETURN v_report;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_to_class_v2(
  _request_id uuid,
  _payload jsonb,
  _destination_plan jsonb,
  _turma_id uuid,
  _card_conflict text DEFAULT 'skip'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.global_import_batches%ROWTYPE;
  v_report jsonb;
  v_updated integer := 0;
  v_remaining_skipped integer := 0;
BEGIN
  IF _card_conflict NOT IN ('skip', 'copy', 'error', 'replace') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;

  IF _card_conflict <> 'replace' THEN
    RETURN public.import_app_piteco_super_package_to_class_v1(
      _request_id, _payload, _destination_plan, _turma_id, _card_conflict
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.global_import_batches
  WHERE user_id = v_uid AND request_id = _request_id;

  IF FOUND THEN
    IF v_existing.options->>'requested_card_conflict' = 'replace' THEN
      RETURN v_existing.summary || jsonb_build_object(
        'batch_id', v_existing.id,
        'request_id', v_existing.request_id,
        'status', v_existing.status
      );
    END IF;
    RAISE EXCEPTION 'request_id já usado com outra política de duplicata.';
  END IF;

  v_report := public.import_app_piteco_super_package_to_class_v1(
    _request_id, _payload, _destination_plan, _turma_id, 'skip'
  );

  v_updated := public.apply_super_import_duplicate_replacements_v1(
    (v_report->>'batch_id')::uuid,
    _payload
  );
  v_remaining_skipped := GREATEST(
    COALESCE((v_report->>'cards_skipped')::integer, 0) - v_updated,
    0
  );
  v_report := v_report || jsonb_build_object(
    'cards_updated', v_updated,
    'cards_skipped', v_remaining_skipped
  );

  UPDATE public.global_import_batches
  SET summary = v_report,
      options = COALESCE(options, '{}'::jsonb) || jsonb_build_object(
        'card_conflict', 'replace',
        'requested_card_conflict', 'replace'
      )
  WHERE id = (v_report->>'batch_id')::uuid
    AND user_id = v_uid;

  RETURN v_report;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_super_import_updated_cards_v1(
  _batch_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item record;
  v_meta jsonb;
  v_restored integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.global_import_batches b
    WHERE b.id = _batch_id AND b.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Importação não encontrada.' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN
    SELECT *
    FROM public.global_import_items
    WHERE batch_id = _batch_id
      AND user_id = v_uid
      AND entity_type = 'card'
      AND action = 'updated'
    ORDER BY id DESC
  LOOP
    v_meta := v_item.metadata;
    UPDATE public.flashcards
    SET term = v_meta->>'term',
        translation = v_meta->>'translation',
        hint = v_meta->>'hint',
        context_tag = v_meta->>'context_tag',
        example_text = v_meta->>'example_text',
        example_translation = v_meta->>'example_translation',
        detailed_explanation = v_meta->>'detailed_explanation',
        usage_notes = v_meta->>'usage_notes',
        common_mistakes = v_meta->>'common_mistakes',
        short_explanation = v_meta->>'short_explanation',
        audio_url = v_meta->>'audio_url',
        image_url_a = v_meta->>'image_url_a',
        image_url_b = v_meta->>'image_url_b',
        lang = v_meta->>'lang',
        display_text = v_meta->>'display_text',
        eval_text = v_meta->>'eval_text',
        note_text = CASE WHEN jsonb_typeof(v_meta->'note_text') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'note_text'))
          ELSE NULL END,
        word_hints = v_meta->'word_hints',
        accepted_answers_en = CASE WHEN jsonb_typeof(v_meta->'accepted_answers_en') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'accepted_answers_en'))
          ELSE NULL END,
        accepted_answers_pt = CASE WHEN jsonb_typeof(v_meta->'accepted_answers_pt') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'accepted_answers_pt'))
          ELSE NULL END,
        parent_card_id = NULLIF(v_meta->>'parent_card_id', '')::uuid,
        layer_index = NULLIF(v_meta->>'layer_index', '')::integer,
        status_group_uid = NULLIF(v_meta->>'status_group_uid', '')::uuid,
        deleted_at = NULLIF(v_meta->>'deleted_at', '')::timestamptz,
        updated_at = COALESCE(NULLIF(v_meta->>'updated_at', '')::timestamptz, now())
    WHERE id = v_item.entity_id
      AND user_id = v_uid;

    IF FOUND THEN v_restored := v_restored + 1; END IF;
  END LOOP;

  RETURN v_restored;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_global_import_v2(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.restore_super_import_updated_cards_v1(_batch_id);
  PERFORM public.undo_global_import_v1(_batch_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_classroom_global_import_v2(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.restore_super_import_updated_cards_v1(_batch_id);
  PERFORM public.undo_classroom_global_import_v1(_batch_id);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_super_import_skipped_card_v1(uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_super_import_duplicate_replacements_v1(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_super_import_updated_cards_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_global_import_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_classroom_global_import_v2(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_classroom_global_import_v2(uuid) TO authenticated;

COMMIT;
