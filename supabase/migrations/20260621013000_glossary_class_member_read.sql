-- Active classroom members need read-only access to the glossary attached to
-- classroom lists. Owners keep the existing ALL policy; this policy grants
-- SELECT only and does not allow students to insert, update or delete entries.

DROP POLICY IF EXISTS glossary_class_members_select ON public.list_glossary;

CREATE POLICY glossary_class_members_select
ON public.list_glossary
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lists l
    JOIN public.turmas t ON t.id = l.class_id
    WHERE l.id = list_glossary.list_id
      AND l.deleted_at IS NULL
      AND t.ativo = true
      AND public.is_turma_member(t.id, (SELECT auth.uid()))
  )
);
