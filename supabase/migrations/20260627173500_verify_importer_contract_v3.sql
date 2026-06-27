-- Deployment guard for all importer RPCs used by the frontend.
DO $$
BEGIN
  IF to_regprocedure('public.execute_app_piteco_super_import_v3(uuid,jsonb,jsonb,jsonb,text,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing atomic Super Importer RPC';
  END IF;
  IF to_regprocedure('public.import_app_piteco_super_package_v2(uuid,jsonb,jsonb,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing personal Super Importer RPC';
  END IF;
  IF to_regprocedure('public.import_app_piteco_super_package_to_class_v1(uuid,jsonb,jsonb,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Missing classroom Super Importer RPC';
  END IF;
  IF to_regprocedure('public.sync_folder_glossaries_from_super_import_v1(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Missing folder glossary synchronization RPC';
  END IF;
  IF to_regprocedure('public.apply_special_flashcard_explanations(jsonb,text)') IS NULL THEN
    RAISE EXCEPTION 'Missing Special Importer apply RPC';
  END IF;
  IF to_regprocedure('public.undo_global_import_v1(uuid)') IS NULL
     OR to_regprocedure('public.undo_classroom_global_import_v1(uuid)') IS NULL
     OR to_regprocedure('public.undo_folder_glossary_batch_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Importer rollback contract is incomplete';
  END IF;
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');
