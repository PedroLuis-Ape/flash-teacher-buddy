BEGIN;

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Least privilege: anonymous portal access uses narrow SECURITY DEFINER RPCs.
-- RLS does not protect TRUNCATE or REFERENCES, so remove every direct base-table
-- privilege and grant back only what the signed-in client actually needs.
REVOKE ALL PRIVILEGES ON TABLE public.folders FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.lists FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.mensagens FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lists TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.mensagens TO authenticated;

-- FOLDERS: remove legacy PUBLIC-role and duplicate policies.
DROP POLICY IF EXISTS "Anyone can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Public can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users or public portal can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Students can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can view class folders they belong to" ON public.folders;
DROP POLICY IF EXISTS "Owner can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can view folders they have access to" ON public.folders;
DROP POLICY IF EXISTS "Owners can delete their own folders" ON public.folders;
DROP POLICY IF EXISTS "Owners can update their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create their own folders" ON public.folders;
DROP POLICY IF EXISTS "Turma owners can view folders in their turmas" ON public.folders;
DROP POLICY IF EXISTS "Turma owners can insert folders for their turmas" ON public.folders;
DROP POLICY IF EXISTS "Turma owners can update folders in their turmas" ON public.folders;
DROP POLICY IF EXISTS "Turma owners can delete folders in their turmas" ON public.folders;

CREATE POLICY "Authenticated users can view folders they have access to"
ON public.folders
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    owner_id = auth.uid()
    OR (
      deleted_at IS NULL
      AND visibility = 'public'
    )
    OR (
      deleted_at IS NULL
      AND visibility = 'class'
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = folders.owner_id
          AND COALESCE(p.public_access_enabled, false) = true
      )
    )
    OR (
      deleted_at IS NULL
      AND visibility = 'class'
      AND class_id IS NOT NULL
      AND (
        public.is_turma_owner(class_id, auth.uid())
        OR public.is_turma_member(class_id, auth.uid())
      )
    )
  )
);

CREATE POLICY "Turma owners can insert folders for their turmas"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    owner_id = auth.uid()
    OR public.is_turma_owner(class_id, auth.uid())
  )
);

CREATE POLICY "Turma owners can update folders in their turmas"
ON public.folders
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_turma_owner(class_id, auth.uid())
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.is_turma_owner(class_id, auth.uid())
);

CREATE POLICY "Turma owners can delete folders in their turmas"
ON public.folders
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_turma_owner(class_id, auth.uid())
);

-- LISTS: remove legacy PUBLIC-role and duplicate policies.
DROP POLICY IF EXISTS "Anyone can view lists from shared folders" ON public.lists;
DROP POLICY IF EXISTS "Public can view lists from shared folders" ON public.lists;
DROP POLICY IF EXISTS "Authenticated users or public portal can view lists from shared" ON public.lists;
DROP POLICY IF EXISTS "Authenticated users can view lists from shared folders" ON public.lists;
DROP POLICY IF EXISTS "Students can view shared lists" ON public.lists;
DROP POLICY IF EXISTS "Authenticated users can view lists they have access to" ON public.lists;
DROP POLICY IF EXISTS "Owner can view own lists" ON public.lists;
DROP POLICY IF EXISTS "Turma owners can view lists in their turmas" ON public.lists;
DROP POLICY IF EXISTS "Turma owners can insert lists for their turmas" ON public.lists;
DROP POLICY IF EXISTS "Turma owners can update lists in their turmas" ON public.lists;
DROP POLICY IF EXISTS "Turma owners can delete lists in their turmas" ON public.lists;

CREATE POLICY "Authenticated users can view lists they have access to"
ON public.lists
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    owner_id = auth.uid()
    OR (
      deleted_at IS NULL
      AND visibility = 'public'
    )
    OR (
      deleted_at IS NULL
      AND visibility = 'class'
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = lists.owner_id
          AND COALESCE(p.public_access_enabled, false) = true
      )
    )
    OR (
      deleted_at IS NULL
      AND visibility = 'class'
      AND class_id IS NOT NULL
      AND (
        public.is_turma_owner(class_id, auth.uid())
        OR public.is_turma_member(class_id, auth.uid())
      )
    )
    OR (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.folders AS f
        WHERE f.id = lists.folder_id
          AND f.deleted_at IS NULL
          AND (
            f.visibility = 'public'
            OR (
              f.visibility = 'class'
              AND EXISTS (
                SELECT 1
                FROM public.profiles AS p
                WHERE p.id = f.owner_id
                  AND COALESCE(p.public_access_enabled, false) = true
              )
            )
            OR (
              f.visibility = 'class'
              AND f.class_id IS NOT NULL
              AND (
                public.is_turma_owner(f.class_id, auth.uid())
                OR public.is_turma_member(f.class_id, auth.uid())
              )
            )
          )
      )
    )
  )
);

CREATE POLICY "Turma owners can insert lists for their turmas"
ON public.lists
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    owner_id = auth.uid()
    OR public.is_turma_owner(class_id, auth.uid())
  )
);

CREATE POLICY "Turma owners can update lists in their turmas"
ON public.lists
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_turma_owner(class_id, auth.uid())
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.is_turma_owner(class_id, auth.uid())
);

CREATE POLICY "Turma owners can delete lists in their turmas"
ON public.lists
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_turma_owner(class_id, auth.uid())
);

-- MESSAGES: replace every PUBLIC-role policy and the two overlapping UPDATE
-- policies with three authenticated-only policies.
DROP POLICY IF EXISTS "Members can view messages in their threads" ON public.mensagens;
DROP POLICY IF EXISTS "Members can send messages in their threads" ON public.mensagens;
DROP POLICY IF EXISTS "Senders can update their own messages" ON public.mensagens;
DROP POLICY IF EXISTS "Senders can soft-delete their messages" ON public.mensagens;
DROP POLICY IF EXISTS "Senders can edit or soft-delete active messages" ON public.mensagens;

CREATE POLICY "Members can view messages in their threads"
ON public.mensagens
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND deleted = false
  AND public.can_access_thread(
    turma_id,
    thread_tipo,
    thread_chave,
    auth.uid()
  )
);

CREATE POLICY "Members can send messages in their threads"
ON public.mensagens
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND sender_id = auth.uid()
  AND public.can_access_thread(
    turma_id,
    thread_tipo,
    thread_chave,
    auth.uid()
  )
);

CREATE POLICY "Senders can edit or soft-delete active messages"
ON public.mensagens
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND sender_id = auth.uid()
  AND deleted = false
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND sender_id = auth.uid()
);

-- Defense in depth: after soft deletion, no later update is possible. Authorship,
-- routing and creation timestamp are immutable even during a legitimate edit.
CREATE OR REPLACE FUNCTION public.guard_mensagens_update_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.deleted = true THEN
    RAISE EXCEPTION 'Deleted messages cannot be modified.' USING ERRCODE = '42501';
  END IF;

  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.turma_id IS DISTINCT FROM OLD.turma_id
     OR NEW.thread_tipo IS DISTINCT FROM OLD.thread_tipo
     OR NEW.thread_chave IS DISTINCT FROM OLD.thread_chave
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Message identity and routing fields are immutable.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_mensagens_update_v1_trigger ON public.mensagens;
CREATE TRIGGER guard_mensagens_update_v1_trigger
BEFORE UPDATE ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.guard_mensagens_update_v1();

COMMIT;

NOTIFY pgrst, 'reload schema';
