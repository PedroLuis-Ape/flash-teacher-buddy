BEGIN;

-- Anonymous access to application content must go through the narrow portal
-- RPCs/views. Direct access to the base tables makes it too easy for a future
-- permissive policy to expose private or class-scoped rows.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC;
REVOKE SELECT ON TABLE public.folders FROM anon, PUBLIC;
REVOKE SELECT ON TABLE public.lists FROM anon, PUBLIC;
REVOKE SELECT ON TABLE public.flashcards FROM anon, PUBLIC;

-- Remove every anonymous/PUBLIC policy from sensitive profile and study-content
-- base tables. Public pages continue to use the dedicated SECURITY DEFINER RPCs
-- and narrow public views documented in LOVABLE_SECURITY_MEMORY.md.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY['profiles', 'folders', 'lists', 'flashcards'])
      AND EXISTS (
        SELECT 1
        FROM unnest(roles) AS role_name
        WHERE role_name::text IN ('anon', 'public')
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END;
$$;

-- Preserve direct access to explicitly public rows for signed-in users. Class
-- content remains governed by the existing owner/member policies.
DROP POLICY IF EXISTS "Authenticated users can read public folders" ON public.folders;
CREATE POLICY "Authenticated users can read public folders"
ON public.folders
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND deleted_at IS NULL
  AND visibility = 'public'
);

DROP POLICY IF EXISTS "Authenticated users can read public lists" ON public.lists;
CREATE POLICY "Authenticated users can read public lists"
ON public.lists
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND deleted_at IS NULL
  AND (
    visibility = 'public'
    OR EXISTS (
      SELECT 1
      FROM public.folders AS folder
      WHERE folder.id = lists.folder_id
        AND folder.deleted_at IS NULL
        AND folder.visibility = 'public'
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can read public flashcards" ON public.flashcards;
CREATE POLICY "Authenticated users can read public flashcards"
ON public.flashcards
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.lists AS list_row
    LEFT JOIN public.folders AS folder ON folder.id = list_row.folder_id
    WHERE list_row.id = flashcards.list_id
      AND list_row.deleted_at IS NULL
      AND (
        list_row.visibility = 'public'
        OR (
          folder.id IS NOT NULL
          AND folder.deleted_at IS NULL
          AND folder.visibility = 'public'
        )
      )
  )
);

-- PiTECoin and financial audit rows are append-only server records. Authenticated
-- clients may read through the approved policies/RPCs, but cannot mutate them
-- directly. SECURITY DEFINER workflows retain access as their function owner.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.pitecoin_transactions
FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.exchange_logs') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.exchange_logs FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regclass('public.purchase_logs') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.purchase_logs FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;

-- A trigger helper is internal implementation detail, not an RPC. It does not
-- need elevated privileges and must not remain executable through PostgREST.
CREATE OR REPLACE FUNCTION public.set_bug_reports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_bug_reports_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_bug_reports_updated_at() FROM anon, authenticated;

-- Report authors may edit only user-controlled draft fields. Status, identity,
-- timestamps and diagnostic identity remain server-controlled.
DO $$
BEGIN
  IF to_regclass('public.bug_reports') IS NOT NULL THEN
    EXECUTE 'REVOKE UPDATE ON TABLE public.bug_reports FROM authenticated';
    EXECUTE 'GRANT UPDATE (category, severity, title, description, page_url, metadata) ON TABLE public.bug_reports TO authenticated';
  END IF;
END;
$$;

-- This RPC is intentionally public and read-only: it powers glossary hints for
-- content already authorized by get_portal_flashcards. Keep the exception
-- explicit so future audits do not replace it with direct table access.
DO $$
BEGIN
  IF to_regprocedure('public.get_account_glossary_for_list_v1(uuid)') IS NOT NULL THEN
    EXECUTE $comment$
      COMMENT ON FUNCTION public.get_account_glossary_for_list_v1(uuid) IS
      'Intentional read-only public RPC. It authorizes the requested list through owner/member checks or get_portal_flashcards and returns only active matching glossary entries.'
    $comment$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_account_glossary_for_list_v1(uuid) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_account_glossary_for_list_v1(uuid) TO anon, authenticated';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
