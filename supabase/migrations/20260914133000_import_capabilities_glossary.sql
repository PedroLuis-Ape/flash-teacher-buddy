BEGIN;

-- get_import_capabilities_v1 não reporta o importador oficial de glossário de
-- pasta. Em vez de inferir suporte no cliente, esta versão aditiva publica o
-- diagnóstico real (função presente + EXECUTE da sessão) mantendo o contrato
-- anterior intacto para quem já consome a v1.
CREATE OR REPLACE FUNCTION public.get_import_capabilities_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_base jsonb := public.get_import_capabilities_v1();
  v_glossary_present boolean := to_regprocedure('public.import_folder_glossary_v2(uuid,jsonb,text,boolean)') IS NOT NULL;
  v_glossary_granted boolean := false;
  v_glossary_ready boolean := false;
BEGIN
  IF v_glossary_present THEN
    v_glossary_granted := has_function_privilege(
      current_user,
      'public.import_folder_glossary_v2(uuid,jsonb,text,boolean)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  v_glossary_ready := v_glossary_present AND v_glossary_granted;

  RETURN v_base || jsonb_build_object(
    'contract_version', '1.1',
    'capabilities', COALESCE(v_base->'capabilities', '{}'::jsonb)
      || jsonb_build_object('glossary', v_glossary_ready),
    'checks', COALESCE(v_base->'checks', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'key', 'glossary_import',
        'code', CASE WHEN v_glossary_present THEN 'grant' ELSE 'rpc' END,
        'status', CASE WHEN v_glossary_ready THEN 'ready' ELSE 'missing' END,
        'required', false,
        'detail', CASE
          WHEN NOT v_glossary_present THEN 'RPC oficial de glossário de pasta (v2) ausente.'
          WHEN NOT v_glossary_granted THEN 'Sessão sem EXECUTE no importador oficial de glossário v2.'
          ELSE 'Importador oficial de glossário de pasta (v2) disponível.'
        END
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_import_capabilities_v2() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_import_capabilities_v2() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_import_capabilities_v2() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
