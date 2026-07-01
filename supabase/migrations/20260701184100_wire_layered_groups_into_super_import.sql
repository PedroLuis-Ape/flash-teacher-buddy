-- Encaminha cards normais ao motor existente e grupos ao motor atômico.
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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_normal_list jsonb;
  v_result jsonb;
  v_glossary jsonb;
  v_glossary_report jsonb;
  v_card record;
  v_group_report jsonb;
  v_cards_created integer := 0;
  v_cards_skipped integer := 0;
  v_groups_created integer := 0;
BEGIN
  IF _card_conflict NOT IN ('skip', 'copy', 'error') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;

  SELECT COALESCE(jsonb_agg(card.value ORDER BY card.ordinality), '[]'::jsonb)
  INTO v_normal_list
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(_list->'cards') = 'array'
      THEN _list->'cards' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS card(value, ordinality)
  WHERE COALESCE(card.value->>'type', 'normal') <> 'layered';

  v_normal_list := jsonb_set(_list, '{cards}', v_normal_list, true);
  v_normal_list := jsonb_set(v_normal_list, '{glossary}', '[]'::jsonb, true);

  v_result := public.import_smart_list_content_v2_impl(
    _uid,
    _list_id,
    v_normal_list,
    _card_conflict,
    _batch_id,
    _list_path
  );

  UPDATE public.lists
  SET primary_side = CASE
        WHEN lower(COALESCE(_list->>'primary_side', 'a')) = 'b' THEN 'b'
        ELSE 'a'
      END,
      updated_at = now()
  WHERE id = _list_id
    AND owner_id = _uid
    AND deleted_at IS NULL;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'original_text', item->>'term',
      'translated_text', item->>'translation',
      'note', NULLIF(BTRIM(item->>'note'), ''),
      'side', CASE WHEN upper(COALESCE(item->>'side', 'A')) = 'B' THEN 'B' ELSE 'A' END,
      'is_active', COALESCE((item->>'active')::boolean, true)
    )),
    '[]'::jsonb
  ) INTO v_glossary
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(_list->'glossary') = 'array'
      THEN _list->'glossary' ELSE '[]'::jsonb END
  ) item
  WHERE NULLIF(BTRIM(item->>'term'), '') IS NOT NULL
    AND NULLIF(BTRIM(item->>'translation'), '') IS NOT NULL;

  IF jsonb_array_length(v_glossary) > 0 THEN
    v_glossary_report := public.import_account_glossary_v1(v_glossary, false);
    v_result := v_result || jsonb_build_object(
      'glossary_created', COALESCE((v_glossary_report->>'inserted')::integer, 0),
      'glossary_updated', 0,
      'glossary_scope', 'account'
    );
  ELSE
    v_result := v_result || jsonb_build_object(
      'glossary_created', 0,
      'glossary_updated', 0,
      'glossary_scope', 'account'
    );
  END IF;

  v_cards_created := COALESCE((v_result->>'cards_created')::integer, 0);
  v_cards_skipped := COALESCE((v_result->>'cards_skipped')::integer, 0);
  v_groups_created := COALESCE((v_result->>'layered_groups_created')::integer, 0);

  FOR v_card IN
    SELECT value, ordinality
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(_list->'cards') = 'array'
        THEN _list->'cards' ELSE '[]'::jsonb END
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
