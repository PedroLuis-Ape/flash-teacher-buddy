-- 1) class_members: restrict the role value an owner can insert
DROP POLICY IF EXISTS "Class owners can add members" ON public.class_members;
CREATE POLICY "Class owners can add members"
ON public.class_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = class_members.class_id
      AND classes.owner_id = auth.uid()
  )
  AND (
    role IN ('student', 'assistant')
    OR (role = 'teacher' AND user_id = auth.uid())
  )
);

-- 2) flashcards: public visibility requires the owner's public page to be enabled
DROP POLICY IF EXISTS "Authenticated users can view flashcards they have access to" ON public.flashcards;
CREATE POLICY "Authenticated users can view flashcards they have access to"
ON public.flashcards
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.lists l
    WHERE l.id = flashcards.list_id
      AND l.deleted_at IS NULL
      AND (
        (
          l.visibility = 'public'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = l.owner_id AND p.public_access_enabled = true
          )
        )
        OR (
          l.visibility = 'class'
          AND l.class_id IS NOT NULL
          AND (is_turma_owner(l.class_id, auth.uid()) OR is_turma_member(l.class_id, auth.uid()))
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.lists l
    JOIN public.folders f ON f.id = l.folder_id
    WHERE l.id = flashcards.list_id
      AND l.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND (
        (
          f.visibility = 'public'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = f.owner_id AND p.public_access_enabled = true
          )
        )
        OR (
          f.visibility = 'class'
          AND f.class_id IS NOT NULL
          AND (is_turma_owner(f.class_id, auth.uid()) OR is_turma_member(f.class_id, auth.uid()))
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.collections c
    WHERE c.id = flashcards.collection_id
      AND (
        (
          c.visibility = 'public'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = c.owner_id AND p.public_access_enabled = true
          )
        )
        OR (
          c.visibility = 'class'
          AND c.class_id IS NOT NULL
          AND is_class_member(c.class_id, auth.uid())
        )
      )
  )
);

-- turma-owner policies must require an authenticated actor with a real class link
DROP POLICY IF EXISTS "Turma owners can view flashcards in their turmas" ON public.flashcards;
CREATE POLICY "Turma owners can view flashcards in their turmas"
ON public.flashcards
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = flashcards.list_id
      AND l.class_id IS NOT NULL
      AND is_turma_owner(l.class_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Turma owners can update flashcards in their turmas" ON public.flashcards;
CREATE POLICY "Turma owners can update flashcards in their turmas"
ON public.flashcards
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = flashcards.list_id
      AND l.class_id IS NOT NULL
      AND is_turma_owner(l.class_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = flashcards.list_id
      AND l.class_id IS NOT NULL
      AND is_turma_owner(l.class_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Turma owners can delete flashcards in their turmas" ON public.flashcards;
CREATE POLICY "Turma owners can delete flashcards in their turmas"
ON public.flashcards
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = flashcards.list_id
      AND l.class_id IS NOT NULL
      AND is_turma_owner(l.class_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Turma owners can insert flashcards in their turmas" ON public.flashcards;
CREATE POLICY "Turma owners can insert flashcards in their turmas"
ON public.flashcards
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = flashcards.list_id
      AND l.class_id IS NOT NULL
      AND is_turma_owner(l.class_id, auth.uid())
  )
);

-- 3) gift_offers: recipients may only move a pending gift to claimed/canceled
CREATE OR REPLACE FUNCTION public.guard_gift_offers_update_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_developer_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() <> OLD.recipient_user_id THEN
    RAISE EXCEPTION 'gift_offers: update not allowed';
  END IF;

  IF NEW.id <> OLD.id
    OR NEW.recipient_user_id <> OLD.recipient_user_id
    OR NEW.skin_id <> OLD.skin_id
    OR COALESCE(NEW.sent_by, '') <> COALESCE(OLD.sent_by, '')
    OR COALESCE(NEW.message, '') <> COALESCE(OLD.message, '')
    OR COALESCE(NEW.request_id, '') <> COALESCE(OLD.request_id, '')
    OR NEW.created_at <> OLD.created_at
    OR COALESCE(NEW.expires_at, 'epoch'::timestamptz) <> COALESCE(OLD.expires_at, 'epoch'::timestamptz)
  THEN
    RAISE EXCEPTION 'gift_offers: only the gift status can be changed by the recipient';
  END IF;

  IF OLD.status <> 'pending' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'gift_offers: gift already processed';
  END IF;

  IF NEW.status NOT IN ('pending', 'claimed', 'canceled') THEN
    RAISE EXCEPTION 'gift_offers: invalid status transition';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_gift_offers_update_v1 ON public.gift_offers;
CREATE TRIGGER guard_gift_offers_update_v1
BEFORE UPDATE ON public.gift_offers
FOR EACH ROW EXECUTE FUNCTION public.guard_gift_offers_update_v1();

DROP POLICY IF EXISTS "Users can update their own gifts (claim/cancel)" ON public.gift_offers;
CREATE POLICY "Users can update their own gifts (claim/cancel)"
ON public.gift_offers
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_user_id AND status = 'pending')
WITH CHECK (
  auth.uid() = recipient_user_id
  AND status IN ('claimed', 'canceled')
);

DROP POLICY IF EXISTS "Developer admins can update all gifts" ON public.gift_offers;
CREATE POLICY "Developer admins can update all gifts"
ON public.gift_offers
FOR UPDATE
TO authenticated
USING (public.is_developer_admin(auth.uid()))
WITH CHECK (public.is_developer_admin(auth.uid()));