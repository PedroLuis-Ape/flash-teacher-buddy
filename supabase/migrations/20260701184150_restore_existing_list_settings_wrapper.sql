-- Restaura a lista de destino como fonte de verdade ao importar conteúdo.
BEGIN;

CREATE OR REPLACE FUNCTION public.import_smart_list_content_v2(
  _uid uuid,
  _list_id uuid,
  _list jsonb,
  _card_conflict text DEFAULT 'skip',
  _batch_id uuid DEFAULT NULL,
  _list_path text DEFAULT '$'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_before public.lists%ROWTYPE;
  v_safe_list jsonb;
  v_normal_cards jsonb;
  v_result jsonb;
  v_card record;
  v_group_report jsonb;
  v_cards_created integer := 0;
  v_cards_skipped integer := 0;
  v_groups_created integer := 0;
BEGIN
  IF v_auth_uid IS NULL OR _uid IS DISTINCT FROM v_auth_uid THEN
    RAISE EXCEPTION 'Usuário inválido para importar nesta lista.' USING ERRCODE = '42501';
  END IF;
  IF _card_conflict NOT IN ('skip', 'copy', 'error') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;

  SELECT * INTO v_before
  FROM public.lists
  WHERE id = _list_id
    AND owner_id = v_auth_uid
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lista inválida ou removida.' USING ERRCODE = '42501';
  END IF;

  v_safe_list := COALESCE(_list, '{}'::jsonb) || jsonb_build_object(
    'front_language', v_before.lang_a,
    'back_language', v_before.lang_b,
    'study_type', v_before.study_type,
    'label_a', v_before.labels_a,
    'label_b', v_before.labels_b,
    'tts_enabled', v_before.tts_enabled
  );

  SELECT COALESCE(jsonb_agg(card.value ORDER BY card.ordinality), '[]'::jsonb)
  INTO v_normal_cards
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(v_safe_list->'cards') = 'array'
      THEN v_safe_list->'cards' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS card(value, ordinality)
  WHERE COALESCE(card.value->>'type', 'normal') <> 'layered';

  v_result := public.import_smart_list_content_v2_untrusted_settings(
    _uid,
    _list_id,
    jsonb_set(v_safe_list, '{cards}', v_normal_cards, true),
    _card_conflict,
    _batch_id,
    _list_path
  );

  v_cards_created := COALESCE((v_result->>'cards_created')::integer, 0);
  v_cards_skipped := COALESCE((v_result->>'cards_skipped')::integer, 0);
  v_groups_created := COALESCE((v_result->>'layered_groups_created')::integer, 0);

  FOR v_card IN
    SELECT value, ordinality
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(v_safe_list->'cards') = 'array'
        THEN v_safe_list->'cards' ELSE '[]'::jsonb END
    ) WITH ORDINALITY
    WHERE COALESCE(value->>'type', 'normal') = 'layered'
  LOOP
    v_group_report := public.import_layered_group_v2(
      _uid,
      _list_id,
      v_card.value,
      _card_conflict,
      _batch_id,
      format('%s.cards[%s]', _list_path, v_card.ordinality - 1)
    );
    v_cards_created := v_cards_created
      + COALESCE((v_group_report->>'cards_created')::integer, 0);
    v_cards_skipped := v_cards_skipped
      + COALESCE((v_group_report->>'cards_skipped')::integer, 0);
    v_groups_created := v_groups_created
      + COALESCE((v_group_report->>'layered_groups_created')::integer, 0);
  END LOOP;

  UPDATE public.lists
  SET folder_id = v_before.folder_id,
      owner_id = v_before.owner_id,
      class_id = v_before.class_id,
      institution_id = v_before.institution_id,
      study_type = v_before.study_type,
      lang = v_before.lang,
      lang_a = v_before.lang_a,
      lang_b = v_before.lang_b,
      labels_a = v_before.labels_a,
      labels_b = v_before.labels_b,
      tts_enabled = v_before.tts_enabled
  WHERE id = _list_id
    AND owner_id = v_auth_uid;

  RETURN v_result || jsonb_build_object(
    'cards_created', v_cards_created,
    'cards_skipped', v_cards_skipped,
    'layered_groups_created', v_groups_created
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) TO authenticated;

COMMIT;
