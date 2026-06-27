-- App Piteco — atomic orchestration for Super Importer 2.0.
-- Cards/lists/folders and the single folder glossary now commit or roll back together.

BEGIN;

DROP FUNCTION IF EXISTS public.execute_app_piteco_super_import_v3(
  uuid, jsonb, jsonb, jsonb, text, uuid, uuid
);

CREATE FUNCTION public.execute_app_piteco_super_import_v3(
  _request_id uuid,
  _card_payload jsonb,
  _glossary_payload jsonb,
  _destination_plan jsonb,
  _card_conflict text DEFAULT 'skip',
  _institution_id uuid DEFAULT NULL,
  _turma_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base jsonb;
  v_glossary jsonb;
  v_batch_id uuid;
  v_final jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  IF _request_id IS NULL THEN
    RAISE EXCEPTION 'request_id é obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(_card_payload) IS DISTINCT FROM 'object'
     OR jsonb_typeof(_glossary_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'E_SCHEMA|$: payload do Super Importador inválido.' USING ERRCODE = '22023';
  END IF;

  IF _turma_id IS NULL THEN
    v_base := public.import_app_piteco_super_package_v2(
      _request_id,
      _card_payload,
      _destination_plan,
      _card_conflict,
      _institution_id
    );
  ELSE
    IF _institution_id IS NOT NULL THEN
      RAISE EXCEPTION 'institution_id não pode ser usado em uma importação de turma.' USING ERRCODE = '22023';
    END IF;

    v_base := public.import_app_piteco_super_package_to_class_v1(
      _request_id,
      _card_payload,
      _destination_plan,
      _turma_id,
      _card_conflict
    );
  END IF;

  v_batch_id := NULLIF(v_base->>'batch_id', '')::uuid;
  IF v_batch_id IS NULL THEN
    RAISE EXCEPTION 'O importador base não devolveu batch_id.';
  END IF;

  -- Idempotent retry: a completed batch that already contains the consolidated
  -- folder glossary must not create another snapshot or duplicate work.
  IF COALESCE(v_base->>'glossary_scope', '') = 'folder' THEN
    RETURN v_base;
  END IF;

  v_glossary := public.sync_folder_glossaries_from_super_import_v1(
    v_batch_id,
    _glossary_payload
  );

  v_final := v_base
    || COALESCE(v_glossary, '{}'::jsonb)
    || jsonb_build_object(
      'glossary_scope', 'folder',
      'target_scope', CASE WHEN _turma_id IS NULL THEN 'personal' ELSE 'classroom' END
    );

  UPDATE public.global_import_batches
  SET summary = v_final,
      status = 'completed',
      completed_at = COALESCE(completed_at, now())
  WHERE id = v_batch_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote de importação não encontrado após a execução.' USING ERRCODE = '42501';
  END IF;

  RETURN v_final;
END;
$$;

REVOKE ALL ON FUNCTION public.execute_app_piteco_super_import_v3(
  uuid, jsonb, jsonb, jsonb, text, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_app_piteco_super_import_v3(
  uuid, jsonb, jsonb, jsonb, text, uuid, uuid
) TO authenticated;

COMMENT ON FUNCTION public.execute_app_piteco_super_import_v3(
  uuid, jsonb, jsonb, jsonb, text, uuid, uuid
) IS 'Atomic Super Importer orchestrator for personal or classroom scope, including the consolidated folder glossary.';

COMMIT;

SELECT pg_notify('pgrst', 'reload schema');
