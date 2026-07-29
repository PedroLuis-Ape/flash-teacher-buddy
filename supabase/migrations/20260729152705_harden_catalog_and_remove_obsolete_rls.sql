BEGIN;

-- Security hardening for the findings reported by the Lovable scanner.
--
-- This migration is intentionally data-preserving:
--   * no catalog row is deleted or rewritten;
--   * no legacy classroom policy that grants access is recreated or broadened;
--   * public learning-list access continues through get_portal_flashcards(uuid).

-- public_catalog already exposes status in the generated production types, but
-- older clean replays can be missing the column because it originated as schema
-- drift. Adding it with the historical default preserves the visibility of rows
-- that were already part of the public projection.
ALTER TABLE public.public_catalog
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.public_catalog'::regclass
      AND conname = 'public_catalog_status_check'
  ) THEN
    ALTER TABLE public.public_catalog
      ADD CONSTRAINT public_catalog_status_check
      CHECK (status IS NULL OR status IN ('draft', 'preview', 'published', 'archived'));
  END IF;
END;
$$;

-- The storefront must never rely on client-side filters to hide drafts.
DROP POLICY IF EXISTS "Anyone can view active skins" ON public.skins_catalog;
DROP POLICY IF EXISTS "Public can view published active skins" ON public.skins_catalog;
CREATE POLICY "Public can view published active skins"
ON public.skins_catalog
FOR SELECT
TO anon, authenticated
USING (
  is_active IS TRUE
  AND status = 'published'
);

-- Administrators still need to review drafts and inactive entries.
DROP POLICY IF EXISTS "Developer admins can view all skins" ON public.skins_catalog;
CREATE POLICY "Developer admins can view all skins"
ON public.skins_catalog
FOR SELECT
TO authenticated
USING (
  public.has_role(
    (SELECT auth.uid()),
    'developer_admin'::public.app_role
  )
);

-- Archived or unpublished assets remain available to the user who already
-- owns them, without exposing them to unrelated authenticated users.
DROP POLICY IF EXISTS "Owners can view acquired skins" ON public.skins_catalog;
CREATE POLICY "Owners can view acquired skins"
ON public.skins_catalog
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_inventory AS inventory
    WHERE inventory.skin_id = skins_catalog.id
      AND inventory.user_id = (SELECT auth.uid())
  )
);

-- A recipient must be able to render the exact item in a pending gift before
-- claiming it, including a package that was archived after the gift was sent.
DROP POLICY IF EXISTS "Recipients can view pending gift skins" ON public.skins_catalog;
CREATE POLICY "Recipients can view pending gift skins"
ON public.skins_catalog
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.gift_offers AS gift
    WHERE gift.skin_id = skins_catalog.id
      AND gift.recipient_user_id = (SELECT auth.uid())
      AND gift.status = 'pending'
  )
);

DROP POLICY IF EXISTS "Anyone can view active approved catalog items" ON public.public_catalog;
DROP POLICY IF EXISTS "Public can view published catalog items" ON public.public_catalog;
CREATE POLICY "Public can view published catalog items"
ON public.public_catalog
FOR SELECT
TO anon, authenticated
USING (
  is_active IS TRUE
  AND approved IS TRUE
  AND status = 'published'
);

DROP POLICY IF EXISTS "Developer admins can view all public catalog items" ON public.public_catalog;
CREATE POLICY "Developer admins can view all public catalog items"
ON public.public_catalog
FOR SELECT
TO authenticated
USING (
  public.has_role(
    (SELECT auth.uid()),
    'developer_admin'::public.app_role
  )
);

DROP POLICY IF EXISTS "Owners can view acquired public catalog items" ON public.public_catalog;
CREATE POLICY "Owners can view acquired public catalog items"
ON public.public_catalog
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_inventory AS inventory
    WHERE inventory.skin_id = public_catalog.id
      AND inventory.user_id = (SELECT auth.uid())
  )
);

-- These policies were created as ordinary PERMISSIVE policies with
-- USING(false). PostgreSQL combines permissive policies with OR, so they never
-- overrode a legitimate allow policy. If no allow policy exists, RLS already
-- defaults to deny. Dropping them is therefore access-neutral.
DROP POLICY IF EXISTS "Deny all access to announcements" ON public.announcements;
DROP POLICY IF EXISTS "Deny all access to classes" ON public.classes;
DROP POLICY IF EXISTS "Deny all access to class_members" ON public.class_members;
DROP POLICY IF EXISTS "Deny all access to threads" ON public.threads;
DROP POLICY IF EXISTS "Deny all access to notifications" ON public.notifications;
DROP POLICY IF EXISTS "Deny all access to messages" ON public.messages;

-- Remove historical SELECT policies that bypass the current class-membership
-- checks. The canonical authenticated policy remains in place, while anonymous
-- list access continues through get_portal_flashcards(uuid).
DROP POLICY IF EXISTS "Owner can view own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Authenticated users or public portal can view flashcards from shared lists"
  ON public.flashcards;
DROP POLICY IF EXISTS "Authenticated or public portal can view flashcards from collections"
  ON public.flashcards;
DROP POLICY IF EXISTS "Authenticated or public portal can view flashcards from collect"
  ON public.flashcards;
DROP POLICY IF EXISTS "Anonymous users can view public collection flashcards"
  ON public.flashcards;

-- Preserve the legacy anonymous public-collection route, but scope the policy
-- explicitly to anon and never allow it to reveal class-only collections.
CREATE POLICY "Anonymous users can view public collection flashcards"
ON public.flashcards
FOR SELECT
TO anon
USING (
  collection_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.collections AS collection
    WHERE collection.id = flashcards.collection_id
      AND collection.visibility = 'public'
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.id = collection.owner_id
          AND COALESCE(profile.public_access_enabled, false) IS TRUE
      )
  )
);

COMMIT;
