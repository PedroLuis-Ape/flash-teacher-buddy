ALTER FUNCTION public.undo_global_import_v1(uuid)
  RENAME TO undo_global_import_v1_impl_v2;

CREATE OR REPLACE FUNCTION public.undo_global_import_v1(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.undo_global_import_v1_impl_v2(_batch_id);

  UPDATE public.lists AS l
  SET primary_side = CASE
        WHEN lower(i.metadata->>'primary_side') = 'b' THEN 'b'
        WHEN lower(i.metadata->>'primary_side') = 'a' THEN 'a'
        ELSE l.primary_side
      END
  FROM public.global_import_items AS i
  WHERE i.batch_id = _batch_id
    AND i.user_id = auth.uid()
    AND i.entity_type = 'list'
    AND i.action IN ('reused', 'replaced')
    AND i.metadata IS NOT NULL
    AND l.id = i.entity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_global_import_v1_impl_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_global_import_v1_impl_v2(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.undo_global_import_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v1(uuid) TO authenticated;
