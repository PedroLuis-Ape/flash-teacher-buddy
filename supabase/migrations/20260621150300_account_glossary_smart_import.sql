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
  v_result jsonb;
  v_glossary_entries jsonb := '[]'::jsonb;
  v_glossary_report jsonb;
  v_list_without_glossary jsonb;
BEGIN
  IF _uid IS NULL OR _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Voce precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'original_text', item->>'term',
        'translated_text', item->>'translation',
        'note', NULLIF(btrim(item->>'note'), ''),
        'side', CASE WHEN upper(COALESCE(item->>'side', 'A')) = 'B' THEN 'B' ELSE 'A' END,
        'is_active', COALESCE((item->>'active')::boolean, true)
      )
    ),
    '[]'::jsonb
  )
  INTO v_glossary_entries
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(_list->'glossary') = 'array' THEN _list->'glossary'
      ELSE '[]'::jsonb
    END
  ) item
  WHERE NULLIF(btrim(item->>'term'), '') IS NOT NULL
    AND NULLIF(btrim(item->>'translation'), '') IS NOT NULL;

  v_list_without_glossary := jsonb_set(_list, '{glossary}', '[]'::jsonb, true);

  v_result := public.import_smart_list_content_v2_impl(
    _uid,
    _list_id,
    v_list_without_glossary,
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

  IF jsonb_array_length(v_glossary_entries) > 0 THEN
    v_glossary_report := public.import_account_glossary_v1(
      v_glossary_entries,
      false
    );

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

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.import_smart_list_content_v2(uuid, uuid, jsonb, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid, uuid, jsonb, text, uuid, text) TO authenticated;

COMMIT;
