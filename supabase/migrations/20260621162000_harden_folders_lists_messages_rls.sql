BEGIN;

-- Public portal access must go through the narrow RPCs/views, never through
-- direct anonymous SELECTs on the base content tables.
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON public.folders FROM anon;
REVOKE SELECT ON public.lists FROM anon;
REVOKE UPDATE ON public.mensagens FROM anon;

-- Remove legacy folder policies that either apply to PUBLIC or can expose
-- shared rows directly. Recreate one explicit authenticated-only policy.
DROP POLICY IF EXISTS "Anyone can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Public can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users or public portal can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Students can view shared folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can view class folders they belong to" ON public.folders;
DROP POLICY IF EXISTS "Owner can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can view folders they have access to" ON public.folders;

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
      AND class_id IS NOT NULL
      AND (
        public.is_turma_owner(class_id, auth.uid())
        OR public.is_turma_member(class_id, auth.uid())
      )
    )
  )
);

-- Remove legacy list policies for the same reason and keep one explicit,
-- authenticated-only policy. Anonymous portal reads remain available through
-- get_portal_* and public_turma_* APIs.
DROP POLICY IF EXISTS "Anyone can view lists from shared folders" ON public.lists;
DROP POLICY IF EXISTS "Public can view lists from shared folders" ON public.lists;
DROP POLICY IF EXISTS "Authenticated users or public portal can view lists from shared" ON public.lists;
DROP POLICY IF EXISTS "Authenticated users can view lists from shared folders" ON public.lists;
DROP POLICY IF EXISTS "Students can view shared lists" ON public.lists;
DROP POLICY IF EXISTS "Authenticated users can view lists they have access to" ON public.lists;
DROP POLICY IF EXISTS "Owner can view own lists" ON public.lists;

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

-- PostgreSQL combines permissive policies with OR. The old broad UPDATE policy
-- made the deleted=false condition in the soft-delete policy ineffective.
DROP POLICY IF EXISTS "Senders can update their own messages" ON public.mensagens;
DROP POLICY IF EXISTS "Senders can soft-delete their messages" ON public.mensagens;
DROP POLICY IF EXISTS "Senders can edit or soft-delete active messages" ON public.mensagens;

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

-- Defense in depth: message routing and authorship are immutable, and a
-- soft-deleted message can never be edited or restored even if a future policy
-- is accidentally broadened.
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

  IF NEW.deleted = false AND OLD.deleted = true THEN
    RAISE EXCEPTION 'Deleted messages cannot be restored.' USING ERRCODE = '42501';
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
