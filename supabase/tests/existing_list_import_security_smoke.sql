\set ON_ERROR_STOP on

DO $$
DECLARE
  v_function text;
  v_oid regprocedure;
  v_entrypoints text[] := ARRAY[
    'public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text)',
    'public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid)',
    'public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text)',
    'public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid)',
    'public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text)',
    'public.undo_global_import_v2(uuid)',
    'public.undo_classroom_global_import_v2(uuid)'
  ];
  v_helpers text[] := ARRAY[
    'public.import_smart_list_content_v2_untrusted_settings(uuid,uuid,jsonb,text,uuid,text)',
    'public.replace_super_import_skipped_card_v1(uuid,text,jsonb)',
    'public.apply_super_import_duplicate_replacements_v1(uuid,jsonb)',
    'public.restore_super_import_updated_cards_v1(uuid)'
  ];
BEGIN
  FOREACH v_function IN ARRAY v_entrypoints LOOP
    v_oid := to_regprocedure(v_function);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Missing public import entrypoint: %', v_function;
    END IF;
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_oid) THEN
      RAISE EXCEPTION 'Entrypoint must be SECURITY DEFINER: %', v_function;
    END IF;
    IF has_function_privilege('anon', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'Anonymous role must not execute entrypoint: %', v_function;
    END IF;
    IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'Authenticated role must execute entrypoint: %', v_function;
    END IF;
  END LOOP;

  FOREACH v_function IN ARRAY v_helpers LOOP
    v_oid := to_regprocedure(v_function);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Missing private import helper: %', v_function;
    END IF;
    IF (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_oid) THEN
      RAISE EXCEPTION 'Private helper must remain SECURITY INVOKER: %', v_function;
    END IF;
    IF has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'Client roles must not execute private helper: %', v_function;
    END IF;
  END LOOP;
END;
$$;
