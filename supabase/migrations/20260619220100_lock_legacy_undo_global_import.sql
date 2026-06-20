-- Keep a renamed legacy implementation only as a rollback artifact.
-- It must not remain callable through the API, and reapplication must be safe.
DO $$
BEGIN
  IF to_regprocedure('public.undo_global_import_v1_legacy(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.undo_global_import_v1_legacy(uuid) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.undo_global_import_v1_legacy(uuid) FROM authenticated';
  END IF;
END;
$$;
