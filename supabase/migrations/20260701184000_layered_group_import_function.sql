-- Cria ou ignora um grupo inteiro; nunca importa camadas parcialmente.
BEGIN;

CREATE OR REPLACE FUNCTION public.import_layered_group_v2(
  _uid uuid,
  _list_id uuid,
  _card jsonb,
  _card_conflict text,
  _batch_id uuid,
  _card_path text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title text := NULLIF(BTRIM(_card->>'group_title'), '');
  v_group_key text := NULLIF(BTRIM(_card->>'key'), '');
  v_suffix text;
  v_parent_id uuid;
  v_conflict_id uuid;
  v_count integer;
BEGIN
  IF _uid IS NULL OR _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF _card_conflict NOT IN ('skip', 'copy', 'error') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lists
    WHERE id = _list_id AND owner_id = _uid AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lista inválida ou sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF v_title IS NULL OR jsonb_typeof(_card->'layers') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'E_SCHEMA|%: grupo em camadas inválido.', _card_path;
  END IF;

  v_count := jsonb_array_length(_card->'layers');
  IF v_count < 2 THEN
    RAISE EXCEPTION 'E_SCHEMA|%.layers: o grupo exige ao menos duas camadas.', _card_path;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_card->'layers') layer
    WHERE NULLIF(BTRIM(layer->>'front'), '') IS NULL
       OR NULLIF(BTRIM(layer->>'back'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'E_EMPTY_CARD_SIDE|%.layers: toda camada precisa de frente e verso.', _card_path;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_card->'layers') layer
    GROUP BY lower(BTRIM(layer->>'front')), lower(BTRIM(layer->>'back'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'E_DUPLICATE_CARD|%.layers: há camadas repetidas.', _card_path;
  END IF;

  SELECT f.id INTO v_conflict_id
  FROM public.flashcards f
  WHERE f.list_id = _list_id
    AND f.user_id = _uid
    AND f.deleted_at IS NULL
    AND (
      (v_group_key IS NOT NULL AND lower(f.smart_key) = lower(v_group_key))
      OR (f.parent_card_id IS NULL AND f.is_layer_group AND lower(BTRIM(f.term)) = lower(v_title))
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(_card->'layers') layer
        WHERE lower(BTRIM(f.term)) = lower(BTRIM(layer->>'front'))
          AND lower(BTRIM(f.translation)) = lower(BTRIM(layer->>'back'))
      )
    )
  LIMIT 1;

  IF v_conflict_id IS NOT NULL AND _card_conflict = 'error' THEN
    RAISE EXCEPTION 'E_DUPLICATE_CARD|%: grupo duplicado ou conflitante.', _card_path;
  END IF;
  IF v_conflict_id IS NOT NULL AND _card_conflict = 'skip' THEN
    IF _batch_id IS NOT NULL THEN
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path
      ) VALUES (_batch_id, _uid, 'card', v_conflict_id, 'skipped', _card_path);
    END IF;
    RETURN jsonb_build_object(
      'cards_created', 0,
      'cards_skipped', v_count,
      'layered_groups_created', 0
    );
  END IF;

  v_suffix := CASE WHEN v_conflict_id IS NOT NULL
    THEN ':copy:' || replace(gen_random_uuid()::text, '-', '') ELSE '' END;

  INSERT INTO public.flashcards(
    list_id, user_id, term, translation, context_tag, smart_key, is_layer_group
  ) VALUES (
    _list_id, _uid, v_title, BTRIM((_card->'layers'->0)->>'back'), v_title,
    CASE WHEN v_group_key IS NULL THEN NULL ELSE v_group_key || v_suffix END,
    true
  ) RETURNING id INTO v_parent_id;

  IF _batch_id IS NOT NULL THEN
    INSERT INTO public.global_import_items(
      batch_id, user_id, entity_type, entity_id, action, item_path
    ) VALUES (_batch_id, _uid, 'card', v_parent_id, 'created', _card_path || '.$group');
  END IF;

  IF _batch_id IS NULL THEN
    INSERT INTO public.flashcards(
      list_id, user_id, term, translation, hint, context_tag,
      example_text, example_translation, detailed_explanation, usage_notes,
      common_mistakes, short_explanation, word_hints, parent_card_id,
      layer_index, accepted_answers_en, smart_key, is_layer_group
    )
    SELECT
      _list_id, _uid, BTRIM(layer.value->>'front'), BTRIM(layer.value->>'back'),
      NULLIF(BTRIM(layer.value->>'hint'), ''),
      COALESCE(NULLIF(BTRIM(layer.value->>'context_tag'), ''), v_title),
      NULLIF(BTRIM(layer.value->>'example'), ''),
      NULLIF(BTRIM(layer.value->>'example_translation'), ''),
      NULLIF(BTRIM(layer.value->>'detailed_explanation'), ''),
      NULLIF(BTRIM(layer.value->>'usage_notes'), ''),
      NULLIF(BTRIM(layer.value->>'common_mistakes'), ''),
      NULLIF(BTRIM(layer.value->>'short_observation'), ''),
      public.smart_word_hints_for_db_v2(layer.value->'word_hints'),
      v_parent_id, layer.ordinality - 1,
      CASE WHEN NULLIF(BTRIM(layer.value->>'short_observation'), '') IS NULL
        THEN ARRAY[]::text[] ELSE ARRAY[BTRIM(layer.value->>'short_observation')] END,
      CASE WHEN NULLIF(BTRIM(layer.value->>'key'), '') IS NULL THEN NULL
        ELSE BTRIM(layer.value->>'key') || v_suffix END,
      false
    FROM jsonb_array_elements(_card->'layers') WITH ORDINALITY AS layer(value, ordinality);
  ELSE
    WITH inserted AS (
      INSERT INTO public.flashcards(
        list_id, user_id, term, translation, hint, context_tag,
        example_text, example_translation, detailed_explanation, usage_notes,
        common_mistakes, short_explanation, word_hints, parent_card_id,
        layer_index, accepted_answers_en, smart_key, is_layer_group
      )
      SELECT
        _list_id, _uid, BTRIM(layer.value->>'front'), BTRIM(layer.value->>'back'),
        NULLIF(BTRIM(layer.value->>'hint'), ''),
        COALESCE(NULLIF(BTRIM(layer.value->>'context_tag'), ''), v_title),
        NULLIF(BTRIM(layer.value->>'example'), ''),
        NULLIF(BTRIM(layer.value->>'example_translation'), ''),
        NULLIF(BTRIM(layer.value->>'detailed_explanation'), ''),
        NULLIF(BTRIM(layer.value->>'usage_notes'), ''),
        NULLIF(BTRIM(layer.value->>'common_mistakes'), ''),
        NULLIF(BTRIM(layer.value->>'short_observation'), ''),
        public.smart_word_hints_for_db_v2(layer.value->'word_hints'),
        v_parent_id, layer.ordinality - 1,
        CASE WHEN NULLIF(BTRIM(layer.value->>'short_observation'), '') IS NULL
          THEN ARRAY[]::text[] ELSE ARRAY[BTRIM(layer.value->>'short_observation')] END,
        CASE WHEN NULLIF(BTRIM(layer.value->>'key'), '') IS NULL THEN NULL
          ELSE BTRIM(layer.value->>'key') || v_suffix END,
        false
      FROM jsonb_array_elements(_card->'layers') WITH ORDINALITY AS layer(value, ordinality)
      RETURNING id, layer_index
    )
    INSERT INTO public.global_import_items(
      batch_id, user_id, entity_type, entity_id, action, item_path
    )
    SELECT _batch_id, _uid, 'card', id, 'created',
      format('%s.layers[%s]', _card_path, layer_index)
    FROM inserted;
  END IF;

  RETURN jsonb_build_object(
    'cards_created', v_count,
    'cards_skipped', 0,
    'layered_groups_created', 1,
    'principal_id', v_parent_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_layered_group_v2(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_layered_group_v2(uuid,uuid,jsonb,text,uuid,text) TO authenticated;

COMMIT;
