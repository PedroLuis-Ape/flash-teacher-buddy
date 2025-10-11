-- Fix RLS policies for shared content visibility by students

-- Update folders SELECT policy to allow authenticated users to see shared folders
DROP POLICY IF EXISTS "Authenticated users or public portal can view shared folders" ON public.folders;

CREATE POLICY "Authenticated users can view shared folders"
ON public.folders
FOR SELECT
USING (
  -- Owner can see their own folders
  (owner_id = auth.uid()) 
  OR 
  -- Any authenticated user can see folders marked as 'class'
  ((visibility = 'class') AND (auth.uid() IS NOT NULL))
  OR
  -- Public portal access (for /share/* routes)
  ((visibility = 'class') AND (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = folders.owner_id 
      AND profiles.public_access_enabled = true
    )
  ))
);

-- Update lists SELECT policy to allow authenticated users to see lists from shared folders
DROP POLICY IF EXISTS "Authenticated users or public portal can view lists from shared" ON public.lists;

CREATE POLICY "Authenticated users can view lists from shared folders"
ON public.lists
FOR SELECT
USING (
  -- Owner can see their own lists
  (owner_id = auth.uid())
  OR
  -- Any authenticated user can see lists from folders marked as 'class'
  (EXISTS (
    SELECT 1 FROM folders
    WHERE folders.id = lists.folder_id
    AND folders.visibility = 'class'
    AND auth.uid() IS NOT NULL
  ))
  OR
  -- Public portal access (for /share/* routes)
  (EXISTS (
    SELECT 1 FROM folders
    WHERE folders.id = lists.folder_id
    AND folders.visibility = 'class'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = folders.owner_id
      AND profiles.public_access_enabled = true
    )
  ))
);

-- Update flashcards SELECT policy to allow authenticated users to see flashcards from shared content
DROP POLICY IF EXISTS "Authenticated users or public portal can view flashcards from s" ON public.flashcards;

CREATE POLICY "Authenticated users can view flashcards from shared content"
ON public.flashcards
FOR SELECT
USING (
  -- Owner can see their own flashcards
  (user_id = auth.uid())
  OR
  -- Any authenticated user can see flashcards from lists in shared folders
  ((list_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1 FROM lists l
      JOIN folders f ON f.id = l.folder_id
      WHERE l.id = flashcards.list_id
      AND f.visibility = 'class'
      AND auth.uid() IS NOT NULL
    )
  ))
  OR
  -- Public portal access (for /share/* routes)
  ((list_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1 FROM lists l
      JOIN folders f ON f.id = l.folder_id
      WHERE l.id = flashcards.list_id
      AND f.visibility = 'class'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = f.owner_id
        AND profiles.public_access_enabled = true
      )
    )
  ))
);