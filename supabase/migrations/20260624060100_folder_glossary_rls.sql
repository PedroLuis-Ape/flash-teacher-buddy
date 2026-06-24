BEGIN;

CREATE OR REPLACE FUNCTION public.can_read_folder_glossary(_folder_id uuid, _uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.folders f
    WHERE f.id = _folder_id
      AND f.deleted_at IS NULL
      AND _uid IS NOT NULL
      AND (
        f.owner_id = _uid
        OR (f.visibility = 'class' AND f.class_id IS NOT NULL AND (public.is_turma_owner(f.class_id, _uid) OR public.is_turma_member(f.class_id, _uid)))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_folder_glossary(_folder_id uuid, _uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.folders f
    WHERE f.id = _folder_id
      AND f.deleted_at IS NULL
      AND _uid IS NOT NULL
      AND (f.owner_id = _uid OR (f.visibility = 'class' AND f.class_id IS NOT NULL AND public.is_turma_owner(f.class_id, _uid)))
  );
$$;

ALTER TABLE public.folder_glossary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS folder_glossary_read ON public.folder_glossary;
CREATE POLICY folder_glossary_read ON public.folder_glossary FOR SELECT TO authenticated
USING (public.can_read_folder_glossary(folder_id, auth.uid()));

DROP POLICY IF EXISTS folder_glossary_insert ON public.folder_glossary;
CREATE POLICY folder_glossary_insert ON public.folder_glossary FOR INSERT TO authenticated
WITH CHECK (public.can_manage_folder_glossary(folder_id, auth.uid()));

DROP POLICY IF EXISTS folder_glossary_update ON public.folder_glossary;
CREATE POLICY folder_glossary_update ON public.folder_glossary FOR UPDATE TO authenticated
USING (public.can_manage_folder_glossary(folder_id, auth.uid()))
WITH CHECK (public.can_manage_folder_glossary(folder_id, auth.uid()));

DROP POLICY IF EXISTS folder_glossary_delete ON public.folder_glossary;
CREATE POLICY folder_glossary_delete ON public.folder_glossary FOR DELETE TO authenticated
USING (public.can_manage_folder_glossary(folder_id, auth.uid()));

COMMIT;
