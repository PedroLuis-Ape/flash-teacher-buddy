
-- 1) app_config: restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can read app config" ON public.app_config;
CREATE POLICY "Authenticated users can read app config"
ON public.app_config
FOR SELECT
TO authenticated
USING (true);

-- 2) collections: require auth on class-visibility branch
DROP POLICY IF EXISTS "Authenticated or public portal can view collections" ON public.collections;
CREATE POLICY "Authenticated or public portal can view collections"
ON public.collections
FOR SELECT
USING (
  (
    visibility = 'public'
    AND auth.uid() IS NOT NULL
  )
  OR (
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = collections.owner_id
        AND profiles.public_access_enabled = true
    )
  )
  OR (
    visibility = 'class'
    AND class_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = collections.owner_id
        AND profiles.public_access_enabled = true
    )
  )
);

-- 3) flashcards: require auth on class-visibility portal branch
DROP POLICY IF EXISTS "Authenticated or public portal can view flashcards from collect" ON public.flashcards;
CREATE POLICY "Authenticated or public portal can view flashcards from collect"
ON public.flashcards
FOR SELECT
USING (
  collection_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.collections
    WHERE collections.id = flashcards.collection_id
      AND (
        (collections.visibility = 'public' AND auth.uid() IS NOT NULL)
        OR (
          collections.visibility = 'public'
          AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = collections.owner_id
              AND profiles.public_access_enabled = true
          )
        )
        OR (
          collections.visibility = 'class'
          AND auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = collections.owner_id
              AND profiles.public_access_enabled = true
          )
        )
      )
  )
);
