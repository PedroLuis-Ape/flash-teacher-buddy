BEGIN;

ALTER FUNCTION public.import_smart_list_content_v2(uuid, uuid, jsonb, text, uuid, text)
  RENAME TO import_smart_list_content_v2_untrusted_settings;

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
  v_before public.lists%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_before FROM public.lists WHERE id = _list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lista inválida ou removida.' USING ERRCODE = '23503';
  END IF;

  v_result := public.import_smart_list_content_v2_untrusted_settings(
    _uid, _list_id, _list, _card_conflict, _batch_id, _list_path
  );

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
  WHERE id = _list_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.import_smart_list_content_v2_untrusted_settings(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) TO authenticated;

COMMIT;
