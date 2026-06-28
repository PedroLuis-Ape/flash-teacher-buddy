BEGIN;

DO $$
BEGIN
  IF to_regprocedure(
    'public.import_smart_list_content_v2_untrusted_settings(uuid,uuid,jsonb,text,uuid,text)'
  ) IS NULL THEN
    IF to_regprocedure(
      'public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text)'
    ) IS NULL THEN
      RAISE EXCEPTION 'Função base import_smart_list_content_v2 não encontrada.';
    END IF;

    ALTER FUNCTION public.import_smart_list_content_v2(uuid, uuid, jsonb, text, uuid, text)
      RENAME TO import_smart_list_content_v2_untrusted_settings;
  END IF;
END;
$$;

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
  v_result jsonb;
BEGIN
  IF v_auth_uid IS NULL OR _uid IS DISTINCT FROM v_auth_uid THEN
    RAISE EXCEPTION 'Usuário inválido para importar nesta lista.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before
  FROM public.lists
  WHERE id = _list_id
    AND owner_id = v_auth_uid
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lista inválida ou removida.' USING ERRCODE = '42501';
  END IF;

  -- The existing list is authoritative. Replace settings in the incoming JSON
  -- before the legacy worker touches the row, avoiding transient constraint
  -- failures and preventing silent changes to language, labels, TTS or study type.
  v_safe_list := COALESCE(_list, '{}'::jsonb) || jsonb_build_object(
    'front_language', v_before.lang_a,
    'back_language', v_before.lang_b,
    'study_type', v_before.study_type,
    'label_a', v_before.labels_a,
    'label_b', v_before.labels_b,
    'tts_enabled', v_before.tts_enabled
  );

  v_result := public.import_smart_list_content_v2_untrusted_settings(
    _uid, _list_id, v_safe_list, _card_conflict, _batch_id, _list_path
  );

  -- Defense in depth for fields the legacy worker or a future migration may
  -- attempt to modify while importing content into an existing list.
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

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.import_smart_list_content_v2_untrusted_settings(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_smart_list_content_v2_untrusted_settings(uuid,uuid,jsonb,text,uuid,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) TO authenticated;

COMMIT;
