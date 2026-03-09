
-- FIX 1: Email exposure - restrict turma member profile visibility
DROP POLICY IF EXISTS "Turma members can view each other profiles" ON public.profiles;

CREATE POLICY "Turma members can view each other profiles (safe)"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.turma_membros tm1
    JOIN public.turma_membros tm2 ON tm1.turma_id = tm2.turma_id
    WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = profiles.id
      AND tm1.ativo = true
      AND tm2.ativo = true
  )
);

CREATE OR REPLACE FUNCTION public.get_safe_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id,
    'first_name', first_name,
    'avatar_url', avatar_url,
    'user_tag', user_tag,
    'user_type', user_type::text,
    'level', level,
    'xp_total', xp_total,
    'avatar_skin_id', avatar_skin_id,
    'mascot_skin_id', mascot_skin_id,
    'ape_id', ape_id,
    'last_active_at', last_active_at
  )
  FROM public.profiles
  WHERE id = p_user_id;
$$;

-- FIX 2: Class-restricted folders
DROP POLICY IF EXISTS "Authenticated users can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Students can view shared folders" ON public.folders;

CREATE POLICY "Authenticated users can view class folders they belong to"
ON public.folders
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR (deleted_at IS NOT NULL AND owner_id = auth.uid())
  OR (visibility = 'public')
  OR (
    visibility = 'class' 
    AND class_id IS NOT NULL 
    AND (
      is_turma_owner(class_id, auth.uid()) 
      OR is_turma_member(class_id, auth.uid())
    )
  )
);

-- FIX 3: Class-restricted lists
DROP POLICY IF EXISTS "Students can view shared lists" ON public.lists;
DROP POLICY IF EXISTS "Authenticated users can view lists from shared folders" ON public.lists;

CREATE POLICY "Authenticated users can view lists they have access to"
ON public.lists
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR (deleted_at IS NOT NULL AND owner_id = auth.uid())
  OR (visibility = 'public')
  OR (
    visibility = 'class'
    AND class_id IS NOT NULL
    AND (
      is_turma_owner(class_id, auth.uid())
      OR is_turma_member(class_id, auth.uid())
    )
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = lists.folder_id
        AND f.visibility = 'public'
        AND f.deleted_at IS NULL
    )
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = lists.folder_id
        AND f.visibility = 'class'
        AND f.class_id IS NOT NULL
        AND f.deleted_at IS NULL
        AND (
          is_turma_owner(f.class_id, auth.uid())
          OR is_turma_member(f.class_id, auth.uid())
        )
    )
  )
);

-- FIX 4: Class-restricted flashcards
DROP POLICY IF EXISTS "Authenticated users can view flashcards from shared content" ON public.flashcards;
DROP POLICY IF EXISTS "Students can view shared flashcards" ON public.flashcards;

CREATE POLICY "Authenticated users can view flashcards they have access to"
ON public.flashcards
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    EXISTS (
      SELECT 1 FROM public.lists l
      WHERE l.id = flashcards.list_id
        AND l.deleted_at IS NULL
        AND (
          l.visibility = 'public'
          OR (
            l.visibility = 'class'
            AND l.class_id IS NOT NULL
            AND (
              is_turma_owner(l.class_id, auth.uid())
              OR is_turma_member(l.class_id, auth.uid())
            )
          )
        )
    )
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.lists l
      JOIN public.folders f ON f.id = l.folder_id
      WHERE l.id = flashcards.list_id
        AND l.deleted_at IS NULL
        AND f.deleted_at IS NULL
        AND (
          f.visibility = 'public'
          OR (
            f.visibility = 'class'
            AND f.class_id IS NOT NULL
            AND (
              is_turma_owner(f.class_id, auth.uid())
              OR is_turma_member(f.class_id, auth.uid())
            )
          )
        )
    )
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = flashcards.collection_id
        AND (
          c.visibility = 'public'
          OR (
            c.visibility = 'class'
            AND c.class_id IS NOT NULL
            AND is_class_member(c.class_id, auth.uid())
          )
        )
    )
  )
);

-- FIX 5: Class-restricted videos (uses created_by, not user_id)
DROP POLICY IF EXISTS "Users can view videos from shared folders" ON public.videos;

CREATE POLICY "Users can view videos from folders they have access to"
ON public.videos
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR (
    EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = videos.folder_id
        AND f.deleted_at IS NULL
        AND (
          f.visibility = 'public'
          OR (
            f.visibility = 'class'
            AND f.class_id IS NOT NULL
            AND (
              is_turma_owner(f.class_id, auth.uid())
              OR is_turma_member(f.class_id, auth.uid())
            )
          )
        )
    )
  )
);

-- FIX 6: Inventory - restrict to owner only
DROP POLICY IF EXISTS "Anyone can view any inventory" ON public.user_inventory;

CREATE POLICY "Users can view their own inventory"
ON public.user_inventory
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- FIX 7: DMs - restrict INSERT to turma owner with proper validation
DROP POLICY IF EXISTS "Turma owners can create DMs" ON public.dms;

CREATE POLICY "Turma owners can create DMs for their turma"
ON public.dms
FOR INSERT
TO authenticated
WITH CHECK (
  is_turma_owner(turma_id, auth.uid())
  AND teacher_id = auth.uid()
  AND is_turma_member(turma_id, aluno_id)
);
