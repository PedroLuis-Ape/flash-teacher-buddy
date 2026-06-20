-- PostgreSQL cannot change a function return type with CREATE OR REPLACE.
-- Rename only the old JSON-returning RPC; reapplying this migration is safe.
DO $$
DECLARE
  v_oid regprocedure := to_regprocedure('public.undo_global_import_v1(uuid)');
BEGIN
  IF v_oid IS NOT NULL
     AND pg_get_function_result(v_oid::oid) = 'jsonb'
     AND to_regprocedure('public.undo_global_import_v1_legacy(uuid)') IS NULL THEN
    ALTER FUNCTION public.undo_global_import_v1(uuid)
      RENAME TO undo_global_import_v1_legacy;
  END IF;
END;
$$;
