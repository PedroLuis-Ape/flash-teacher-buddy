BEGIN;

CREATE OR REPLACE FUNCTION public.get_import_capabilities_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_authenticated boolean := auth.uid() IS NOT NULL;
  v_gateway_present boolean := to_regprocedure('public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid)') IS NOT NULL;
  v_classroom_gateway_present boolean := to_regprocedure('public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text)') IS NOT NULL;
  v_undo_present boolean := to_regprocedure('public.undo_global_import_v2(uuid)') IS NOT NULL;
  v_classroom_undo_present boolean := to_regprocedure('public.undo_classroom_global_import_v2(uuid)') IS NOT NULL;
  v_glossary_present boolean := to_regprocedure('public.sync_folder_glossaries_from_super_import_v1(uuid,jsonb)') IS NOT NULL;
  v_layer_rpc_present boolean := to_regprocedure('public.save_layered_card_group_v2(uuid,uuid,text,jsonb)') IS NOT NULL;
  v_gateway_granted boolean := false;
  v_classroom_gateway_granted boolean := false;
  v_undo_granted boolean := false;
  v_classroom_undo_granted boolean := false;
  v_glossary_granted boolean := false;
  v_layer_rpc_granted boolean := false;
  v_flashcards_schema boolean := false;
  v_import_schema boolean := false;
  v_enriched_schema boolean := false;
  v_layer_schema boolean := false;
  v_flashcards_rls boolean := false;
  v_import_batches_rls boolean := false;
  v_import_items_rls boolean := false;
  v_basic_import boolean := false;
  v_safe_import boolean := false;
  v_enriched_fields boolean := false;
  v_layered_cards boolean := false;
  v_engine_version text := 'unknown';
  v_migration_revision text := null;
  v_checks jsonb := '[]'::jsonb;
  v_status text;
BEGIN
  IF v_gateway_present THEN
    v_gateway_granted := has_function_privilege(
      current_user,
      'public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_classroom_gateway_present THEN
    v_classroom_gateway_granted := has_function_privilege(
      current_user,
      'public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_undo_present THEN
    v_undo_granted := has_function_privilege(
      current_user,
      'public.undo_global_import_v2(uuid)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_classroom_undo_present THEN
    v_classroom_undo_granted := has_function_privilege(
      current_user,
      'public.undo_classroom_global_import_v2(uuid)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_glossary_present THEN
    v_glossary_granted := has_function_privilege(
      current_user,
      'public.sync_folder_glossaries_from_super_import_v1(uuid,jsonb)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_layer_rpc_present THEN
    v_layer_rpc_granted := has_function_privilege(
      current_user,
      'public.save_layered_card_group_v2(uuid,uuid,text,jsonb)'::regprocedure,
      'EXECUTE'
    );
  END IF;

  SELECT to_regclass('public.flashcards') IS NOT NULL
    AND to_regclass('public.lists') IS NOT NULL
    AND to_regclass('public.folders') IS NOT NULL
  INTO v_flashcards_schema;

  SELECT to_regclass('public.global_import_batches') IS NOT NULL
    AND to_regclass('public.global_import_items') IS NOT NULL
  INTO v_import_schema;

  SELECT count(*) = 10
  INTO v_enriched_schema
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'flashcards'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname = ANY (ARRAY[
      'context_tag', 'example_text', 'example_translation', 'detailed_explanation',
      'usage_notes', 'common_mistakes', 'short_explanation', 'word_hints',
      'parent_card_id', 'layer_index'
  ]);

  SELECT count(*) = 2
  INTO v_layer_schema
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'flashcards'
    AND a.attnum > 0
    AND NOT a.attisdropped
  AND a.attname = ANY (ARRAY['parent_card_id', 'layer_index']);

  SELECT COALESCE(bool_and(c.relrowsecurity), false)
  INTO v_flashcards_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'flashcards';

  SELECT COALESCE(bool_and(c.relrowsecurity), false)
  INTO v_import_batches_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'global_import_batches';

  SELECT COALESCE(bool_and(c.relrowsecurity), false)
  INTO v_import_items_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'global_import_items';

  v_basic_import := v_authenticated AND v_gateway_present AND v_gateway_granted AND v_flashcards_schema;
  v_safe_import := v_basic_import
    AND v_import_schema
    AND v_import_batches_rls
    AND v_import_items_rls
    AND v_undo_present
    AND v_undo_granted;
  v_enriched_fields := v_safe_import AND v_enriched_schema;
  v_layered_cards := v_enriched_fields
    AND v_layer_schema
    AND v_layer_rpc_present
    AND v_layer_rpc_granted;

  IF v_layered_cards THEN
    v_engine_version := '2.0';
    v_migration_revision := '20260712223000';
  ELSIF v_enriched_fields THEN
    v_engine_version := '2.0-rich-import';
  ELSIF v_safe_import THEN
    v_engine_version := '1.0-safe-import';
  END IF;

  v_status := CASE WHEN v_authenticated THEN 'ready' ELSE 'missing' END;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'auth', 'code', 'auth', 'status', v_status, 'required', true,
    'detail', CASE WHEN v_authenticated THEN 'Sessão autenticada disponível.' ELSE 'Sessão ausente ou expirada.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'personal_gateway', 'code', CASE WHEN v_gateway_present THEN 'grant' ELSE 'rpc' END,
    'status', CASE WHEN NOT v_gateway_present THEN 'missing' WHEN NOT v_gateway_granted THEN 'missing' ELSE 'ready' END,
    'required', true, 'detail', CASE WHEN NOT v_gateway_present THEN 'Gateway transacional pessoal ausente.' WHEN NOT v_gateway_granted THEN 'Sessão sem EXECUTE no gateway pessoal.' ELSE 'Gateway transacional pessoal disponível.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'classroom_gateway', 'code', CASE WHEN v_classroom_gateway_present THEN 'grant' ELSE 'rpc' END,
    'status', CASE WHEN NOT v_classroom_gateway_present THEN 'missing' WHEN NOT v_classroom_gateway_granted THEN 'missing' ELSE 'ready' END,
    'required', false, 'detail', CASE WHEN NOT v_classroom_gateway_present THEN 'Gateway transacional de turma ausente.' WHEN NOT v_classroom_gateway_granted THEN 'Sessão sem EXECUTE no gateway de turma.' ELSE 'Gateway transacional de turma disponível.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'import_schema', 'code', 'schema',
    'status', CASE WHEN v_import_schema THEN 'ready' ELSE 'missing' END,
    'required', true, 'detail', CASE WHEN v_import_schema THEN 'Estruturas de lote presentes.' ELSE 'Estruturas global_import ausentes.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'enriched_schema', 'code', 'schema',
    'status', CASE WHEN v_enriched_schema THEN 'ready' ELSE 'missing' END,
    'required', false, 'detail', CASE WHEN v_enriched_schema THEN 'Colunas enriquecidas presentes.' ELSE 'Uma ou mais colunas enriquecidas estão ausentes.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'layered_migration', 'code', CASE WHEN v_layer_rpc_present THEN 'grant' ELSE 'migration' END,
    'status', CASE WHEN NOT v_layer_rpc_present THEN 'missing' WHEN NOT v_layer_rpc_granted THEN 'missing' WHEN NOT v_layer_schema THEN 'missing' ELSE 'ready' END,
    'required', false, 'detail', CASE WHEN NOT v_layer_rpc_present THEN 'Migration 20260712223000 não aplicada: RPC atômico de camadas ausente.' WHEN NOT v_layer_rpc_granted THEN 'RPC atômico de camadas sem EXECUTE para a sessão.' WHEN NOT v_layer_schema THEN 'Colunas de identidade de camada ausentes.' ELSE 'Migration atômica de camadas disponível.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'undo', 'code', CASE WHEN v_undo_present THEN 'grant' ELSE 'rpc' END,
    'status', CASE WHEN NOT v_undo_present THEN 'missing' WHEN NOT v_undo_granted THEN 'missing' ELSE 'ready' END,
    'required', true, 'detail', CASE WHEN NOT v_undo_present THEN 'Função de desfazer ausente.' WHEN NOT v_undo_granted THEN 'Sessão sem EXECUTE na função de desfazer.' ELSE 'Desfazer por lote disponível.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'rls', 'code', 'schema',
    'status', CASE WHEN v_flashcards_rls AND v_import_batches_rls AND v_import_items_rls THEN 'ready' ELSE 'missing' END,
    'required', true, 'detail', CASE WHEN v_flashcards_rls AND v_import_batches_rls AND v_import_items_rls THEN 'RLS habilitado nas tabelas de importação.' ELSE 'RLS ausente em uma tabela de importação.' END
  ));

  RETURN jsonb_build_object(
    'contract_version', '1',
    'engine_version', v_engine_version,
    'migration_revision', v_migration_revision,
    'project_ref', null,
    'environment', 'supabase-database',
    'database_name', current_database(),
    'server_version', current_setting('server_version'),
    'capabilities', jsonb_build_object(
      'safe_import', v_safe_import,
      'layered_cards', v_layered_cards,
      'enriched_fields', v_enriched_fields,
      'basic_import', v_basic_import
    ),
    'checks', v_checks,
    'diagnostic_codes', CASE
      WHEN v_layered_cards THEN jsonb_build_array('ready')
      WHEN NOT v_authenticated THEN jsonb_build_array('auth')
      WHEN NOT v_gateway_present OR NOT v_gateway_granted THEN jsonb_build_array(CASE WHEN v_gateway_present THEN 'grant' ELSE 'rpc' END)
      WHEN NOT v_import_schema OR NOT v_import_batches_rls OR NOT v_import_items_rls THEN jsonb_build_array('schema')
      WHEN NOT v_layer_rpc_present THEN jsonb_build_array('migration')
      WHEN NOT v_layer_rpc_granted THEN jsonb_build_array('grant')
      ELSE jsonb_build_array('unknown')
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_import_capabilities_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_import_capabilities_v1() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_import_capabilities_v1() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
