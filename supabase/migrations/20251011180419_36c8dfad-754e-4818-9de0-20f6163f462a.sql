-- Corrigir policy de flashcards para permitir acesso via collections compartilhadas
DROP POLICY IF EXISTS "Anyone can view flashcards from collections" ON public.flashcards;

CREATE POLICY "Anyone can view flashcards from collections"
ON public.flashcards
FOR SELECT
USING (
  (collection_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1
      FROM collections
      WHERE collections.id = flashcards.collection_id
        AND (
          collections.visibility = 'public'
          OR (
            collections.visibility = 'class'
            AND EXISTS (
              SELECT 1
              FROM profiles
              WHERE profiles.id = collections.owner_id
                AND profiles.public_access_enabled = true
            )
          )
        )
    )
  )
);

-- Atualizar policy de collections para simplificar acesso público
DROP POLICY IF EXISTS "Public can view collections from teachers with public access" ON public.collections;

CREATE POLICY "Public can view collections from teachers with public access"
ON public.collections
FOR SELECT
USING (
  visibility = 'public'
  OR (
    visibility = 'class'
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = collections.owner_id
        AND profiles.public_access_enabled = true
    )
  )
);

-- Garantir que collection owners podem criar flashcards
DROP POLICY IF EXISTS "Collection owners can create flashcards" ON public.flashcards;

CREATE POLICY "Collection owners can create flashcards"
ON public.flashcards
FOR INSERT
WITH CHECK (
  (collection_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1
      FROM collections
      WHERE collections.id = flashcards.collection_id
        AND collections.owner_id = auth.uid()
    )
  )
);

-- Garantir que collection owners podem atualizar flashcards
DROP POLICY IF EXISTS "Collection owners can update flashcards" ON public.flashcards;

CREATE POLICY "Collection owners can update flashcards"
ON public.flashcards
FOR UPDATE
USING (
  (collection_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1
      FROM collections
      WHERE collections.id = flashcards.collection_id
        AND collections.owner_id = auth.uid()
    )
  )
);

-- Garantir que collection owners podem deletar flashcards
DROP POLICY IF EXISTS "Collection owners can delete flashcards" ON public.flashcards;

CREATE POLICY "Collection owners can delete flashcards"
ON public.flashcards
FOR DELETE
USING (
  (collection_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1
      FROM collections
      WHERE collections.id = flashcards.collection_id
        AND collections.owner_id = auth.uid()
    )
  )
);