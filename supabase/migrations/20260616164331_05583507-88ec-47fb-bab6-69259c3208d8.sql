
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND (user_type IS NULL OR user_type::text = 'aluno')
  AND COALESCE(is_teacher, false) = false
  AND COALESCE(public_access_enabled, false) = false
);

ALTER PUBLICATION supabase_realtime DROP TABLE public.turma_student_activity;

DROP POLICY IF EXISTS "Authenticated or public portal can view collections" ON public.collections;
CREATE POLICY "Authenticated or public portal can view collections"
ON public.collections
FOR SELECT
USING (
  (
    visibility = 'public'
    AND (
      auth.uid() IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = collections.owner_id AND p.public_access_enabled = true)
    )
  )
  OR (
    visibility = 'class'
    AND class_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND public.is_class_member(class_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated or public portal can view flashcards from collect" ON public.flashcards;
CREATE POLICY "Authenticated or public portal can view flashcards from collect"
ON public.flashcards
FOR SELECT
USING (
  collection_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = flashcards.collection_id
      AND (
        (
          c.visibility = 'public'
          AND (
            auth.uid() IS NOT NULL
            OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = c.owner_id AND p.public_access_enabled = true)
          )
        )
        OR (
          c.visibility = 'class'
          AND c.class_id IS NOT NULL
          AND auth.uid() IS NOT NULL
          AND public.is_class_member(c.class_id, auth.uid())
        )
      )
  )
);
