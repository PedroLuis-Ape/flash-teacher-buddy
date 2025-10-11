-- Drop old flashcard policies that reference collections
DROP POLICY IF EXISTS "Only collection owners can create flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Only collection owners can update flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Only collection owners can delete flashcards" ON public.flashcards;

-- Create new flashcard policies for list-based ownership
CREATE POLICY "List owners can create flashcards"
  ON public.flashcards FOR INSERT
  WITH CHECK (
    list_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = flashcards.list_id
      AND lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "List owners can update flashcards"
  ON public.flashcards FOR UPDATE
  USING (
    list_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = flashcards.list_id
      AND lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "List owners can delete flashcards"
  ON public.flashcards FOR DELETE
  USING (
    list_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = flashcards.list_id
      AND lists.owner_id = auth.uid()
    )
  );