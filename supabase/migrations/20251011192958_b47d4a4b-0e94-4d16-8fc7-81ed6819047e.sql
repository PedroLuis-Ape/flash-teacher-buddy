-- Atualização RLS: usuários autenticados podem ver conteúdo compartilhado (visibility='class')

-- FOLDERS: qualquer usuário autenticado pode ver pastas compartilhadas
DROP POLICY IF EXISTS "Authenticated users can view shared folders" ON public.folders;
CREATE POLICY "Authenticated users can view shared folders"
ON public.folders
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  OR visibility = 'class'
);

-- LISTS: qualquer usuário autenticado pode ver listas de pastas compartilhadas
DROP POLICY IF EXISTS "Authenticated users can view lists from shared folders" ON public.lists;
CREATE POLICY "Authenticated users can view lists from shared folders"
ON public.lists
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.folders
    WHERE folders.id = lists.folder_id
    AND folders.visibility = 'class'
  )
);

-- FLASHCARDS: qualquer usuário autenticado pode ver flashcards de listas/pastas compartilhadas
DROP POLICY IF EXISTS "Authenticated users can view flashcards from shared content" ON public.flashcards;
CREATE POLICY "Authenticated users can view flashcards from shared content"
ON public.flashcards
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    list_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 
      FROM public.lists l
      JOIN public.folders f ON f.id = l.folder_id
      WHERE l.id = flashcards.list_id
      AND f.visibility = 'class'
    )
  )
  OR (
    collection_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 
      FROM public.collections c
      WHERE c.id = flashcards.collection_id
      AND c.visibility = 'class'
    )
  )
);