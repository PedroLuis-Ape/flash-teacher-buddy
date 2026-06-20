-- Keep the public undo RPC scoped to the authenticated caller.
ALTER FUNCTION public.undo_global_import_v1(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.undo_global_import_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v1(uuid) TO authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.undo_global_import_v1_impl_v2(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.undo_global_import_v1_impl_v2(uuid) SECURITY INVOKER';
    EXECUTE 'REVOKE ALL ON FUNCTION public.undo_global_import_v1_impl_v2(uuid) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.undo_global_import_v1_impl_v2(uuid) FROM authenticated';
  END IF;
  IF to_regprocedure('public.undo_global_import_v1_legacy(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.undo_global_import_v1_legacy(uuid) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.undo_global_import_v1_legacy(uuid) FROM authenticated';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_global_import_items_user_id
  ON public.global_import_items(user_id);

DROP POLICY IF EXISTS glossary_owner_all ON public.list_glossary;
CREATE POLICY glossary_owner_all ON public.list_glossary
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lists l
      WHERE l.id = list_glossary.list_id
        AND l.owner_id = (SELECT auth.uid())
        AND l.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lists l
      WHERE l.id = list_glossary.list_id
        AND l.owner_id = (SELECT auth.uid())
        AND l.deleted_at IS NULL
    )
  );
