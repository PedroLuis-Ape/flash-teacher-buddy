-- Renomear campos flashcards: front→term, back→translation
ALTER TABLE public.flashcards RENAME COLUMN front TO term;
ALTER TABLE public.flashcards RENAME COLUMN back TO translation;

-- Adicionar campo hint se não existir (já existe, mas garantir)
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS hint text;

-- Criar políticas RLS para folders (professor = CRUD, aluno = read compartilhado)
DROP POLICY IF EXISTS "Owners can manage their folders" ON public.folders;
DROP POLICY IF EXISTS "Students can view shared folders" ON public.folders;

CREATE POLICY "Owners can manage their folders"
ON public.folders
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Students can view shared folders"
ON public.folders
FOR SELECT
TO authenticated
USING (visibility = 'class' OR visibility = 'public');

-- Criar políticas RLS para lists (professor = CRUD, aluno = read compartilhado com herança)
DROP POLICY IF EXISTS "Owners can manage their lists" ON public.lists;
DROP POLICY IF EXISTS "Students can view shared lists" ON public.lists;

CREATE POLICY "Owners can manage their lists"
ON public.lists
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Students can view shared lists"
ON public.lists
FOR SELECT
TO authenticated
USING (
  visibility = 'class' 
  OR visibility = 'public'
  OR EXISTS (
    SELECT 1 FROM public.folders 
    WHERE folders.id = lists.folder_id 
    AND (folders.visibility = 'class' OR folders.visibility = 'public')
  )
);

-- Criar políticas RLS para flashcards (professor = CRUD, aluno = read compartilhado com herança)
DROP POLICY IF EXISTS "Owners can manage their flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Students can view shared flashcards" ON public.flashcards;

CREATE POLICY "Owners can manage their flashcards"
ON public.flashcards
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students can view shared flashcards"
ON public.flashcards
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lists
    JOIN public.folders ON folders.id = lists.folder_id
    WHERE lists.id = flashcards.list_id
    AND (
      lists.visibility = 'class'
      OR lists.visibility = 'public'
      OR folders.visibility = 'class'
      OR folders.visibility = 'public'
    )
  )
);