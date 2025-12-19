-- ========================================
-- FIX 1: Professor CRUD in Turmas/Atribuições
-- Allow teachers who own a turma to edit folders/lists/flashcards that belong to their turma
-- ========================================

-- FOLDERS: Allow turma owners to CRUD folders linked to their turma via class_id
CREATE POLICY "Turma owners can insert folders for their turmas"
ON public.folders
FOR INSERT
WITH CHECK (
  is_turma_owner(class_id, auth.uid()) 
  OR (owner_id = auth.uid())
);

CREATE POLICY "Turma owners can update folders in their turmas"
ON public.folders
FOR UPDATE
USING (
  is_turma_owner(class_id, auth.uid())
)
WITH CHECK (
  is_turma_owner(class_id, auth.uid())
);

CREATE POLICY "Turma owners can delete folders in their turmas"
ON public.folders
FOR DELETE
USING (
  is_turma_owner(class_id, auth.uid())
);

-- LISTS: Allow turma owners to CRUD lists linked to their turma via class_id
CREATE POLICY "Turma owners can insert lists for their turmas"
ON public.lists
FOR INSERT
WITH CHECK (
  is_turma_owner(class_id, auth.uid())
  OR (owner_id = auth.uid())
);

CREATE POLICY "Turma owners can update lists in their turmas"
ON public.lists
FOR UPDATE
USING (
  is_turma_owner(class_id, auth.uid())
)
WITH CHECK (
  is_turma_owner(class_id, auth.uid())
);

CREATE POLICY "Turma owners can delete lists in their turmas"
ON public.lists
FOR DELETE
USING (
  is_turma_owner(class_id, auth.uid())
);

-- FLASHCARDS: Allow turma owners to CRUD flashcards belonging to lists in their turmas
CREATE POLICY "Turma owners can insert flashcards in their turmas"
ON public.flashcards
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id
    AND is_turma_owner(l.class_id, auth.uid())
  )
);

CREATE POLICY "Turma owners can update flashcards in their turmas"
ON public.flashcards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id
    AND is_turma_owner(l.class_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id
    AND is_turma_owner(l.class_id, auth.uid())
  )
);

CREATE POLICY "Turma owners can delete flashcards in their turmas"
ON public.flashcards
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id
    AND is_turma_owner(l.class_id, auth.uid())
  )
);

-- SELECT: Allow turma owners to view all content in their turmas
CREATE POLICY "Turma owners can view folders in their turmas"
ON public.folders
FOR SELECT
USING (
  is_turma_owner(class_id, auth.uid())
);

CREATE POLICY "Turma owners can view lists in their turmas"
ON public.lists
FOR SELECT
USING (
  is_turma_owner(class_id, auth.uid())
);

CREATE POLICY "Turma owners can view flashcards in their turmas"
ON public.flashcards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id
    AND is_turma_owner(l.class_id, auth.uid())
  )
);