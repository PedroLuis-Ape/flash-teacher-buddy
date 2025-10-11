-- Reinstate list-based write policies for flashcards and keep collection-based as additive
DROP POLICY IF EXISTS "List owners can create flashcards" ON public.flashcards;
CREATE POLICY "List owners can create flashcards"
ON public.flashcards
FOR INSERT
WITH CHECK (
  (list_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1 FROM lists WHERE lists.id = flashcards.list_id AND lists.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "List owners can update flashcards" ON public.flashcards;
CREATE POLICY "List owners can update flashcards"
ON public.flashcards
FOR UPDATE
USING (
  (list_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1 FROM lists WHERE lists.id = flashcards.list_id AND lists.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "List owners can delete flashcards" ON public.flashcards;
CREATE POLICY "List owners can delete flashcards"
ON public.flashcards
FOR DELETE
USING (
  (list_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1 FROM lists WHERE lists.id = flashcards.list_id AND lists.owner_id = auth.uid()
    )
  )
);

-- Ensure SELECT via shared lists inheritance remains
DROP POLICY IF EXISTS "Anyone can view flashcards from shared lists" ON public.flashcards;
CREATE POLICY "Anyone can view flashcards from shared lists"
ON public.flashcards
FOR SELECT
USING (
  (list_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1
      FROM lists l
      JOIN folders f ON f.id = l.folder_id
      WHERE l.id = flashcards.list_id
        AND f.visibility = 'class'
    )
  )
);
