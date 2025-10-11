-- ============================================
-- RLS Policies para acesso read-only de alunos
-- ============================================

-- Folders: Permitir SELECT quando visibility='class' (além do owner)
DROP POLICY IF EXISTS "Owner can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Public can view shared folders" ON public.folders;

CREATE POLICY "Owner can view own folders"
  ON public.folders FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Anyone can view shared folders"
  ON public.folders FOR SELECT
  USING (visibility = 'class');

-- Lists: Permitir SELECT quando a pasta pai tem visibility='class'
DROP POLICY IF EXISTS "Owner can view own lists" ON public.lists;
DROP POLICY IF EXISTS "Public can view lists from shared folders" ON public.lists;

CREATE POLICY "Owner can view own lists"
  ON public.lists FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Anyone can view lists from shared folders"
  ON public.lists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.folders
      WHERE folders.id = lists.folder_id
      AND folders.visibility = 'class'
    )
  );

-- Flashcards: Permitir SELECT quando a lista pai pertence a pasta compartilhada
DROP POLICY IF EXISTS "Owner can view own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Public can view flashcards from shared lists" ON public.flashcards;

CREATE POLICY "Owner can view own flashcards"
  ON public.flashcards FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can view flashcards from shared lists"
  ON public.flashcards FOR SELECT
  USING (
    list_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.lists l
      JOIN public.folders f ON f.id = l.folder_id
      WHERE l.id = flashcards.list_id
      AND f.visibility = 'class'
    )
  );