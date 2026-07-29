\set ON_ERROR_STOP on

-- Read-only contract smoke test. Run only after
-- 20260729152705_harden_catalog_and_remove_obsolete_rls.sql has been applied to
-- a disposable or staging database.

DO $$
DECLARE
  v_policy_count integer;
  v_policy_qual text;
  v_legacy_policy text;
  v_table text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_catalog'
      AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'public_catalog.status is missing';
  END IF;

  SELECT count(*), max(qual)
  INTO v_policy_count, v_policy_qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'skins_catalog'
    AND policyname = 'Public can view published active skins'
    AND cmd = 'SELECT'
    AND roles @> ARRAY['anon'::name, 'authenticated'::name];

  IF v_policy_count <> 1
     OR v_policy_qual NOT LIKE '%is_active%true%'
     OR v_policy_qual NOT LIKE '%status%published%' THEN
    RAISE EXCEPTION 'skins_catalog public policy is not restricted to published active items';
  END IF;

  SELECT count(*), max(qual)
  INTO v_policy_count, v_policy_qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'public_catalog'
    AND policyname = 'Public can view published catalog items'
    AND cmd = 'SELECT'
    AND roles @> ARRAY['anon'::name, 'authenticated'::name];

  IF v_policy_count <> 1
     OR v_policy_qual NOT LIKE '%is_active%true%'
     OR v_policy_qual NOT LIKE '%approved%true%'
     OR v_policy_qual NOT LIKE '%status%published%' THEN
    RAISE EXCEPTION 'public_catalog public policy is not restricted to published approved active items';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'skins_catalog'
      AND policyname = 'Developer admins can view all skins'
      AND roles @> ARRAY['authenticated'::name]
  ) THEN
    RAISE EXCEPTION 'developer-admin skins_catalog read policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'skins_catalog'
      AND policyname = 'Owners can view acquired skins'
      AND roles @> ARRAY['authenticated'::name]
  ) THEN
    RAISE EXCEPTION 'acquired skins owner policy is missing';
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'announcements',
    'classes',
    'class_members',
    'threads',
    'notifications',
    'messages'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
        AND policyname = 'Deny all access to ' || v_table
    ) THEN
      RAISE EXCEPTION 'redundant deny-all policy remains on %', v_table;
    END IF;
  END LOOP;

  FOREACH v_legacy_policy IN ARRAY ARRAY[
    'Authenticated users or public portal can view flashcards from shared lists',
    'Authenticated or public portal can view flashcards from collections',
    'Authenticated or public portal can view flashcards from collect',
    'Owner can view own flashcards'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'flashcards'
        AND policyname = v_legacy_policy
    ) THEN
      RAISE EXCEPTION 'obsolete flashcard policy remains: %', v_legacy_policy;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'flashcards'
      AND policyname = 'Authenticated users can view flashcards they have access to'
      AND roles = ARRAY['authenticated'::name]
  ) THEN
    RAISE EXCEPTION 'canonical authenticated flashcard policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'flashcards'
      AND policyname = 'Anonymous users can view public collection flashcards'
      AND roles = ARRAY['anon'::name]
      AND qual LIKE '%visibility%public%'
      AND qual NOT LIKE '%visibility%class%'
  ) THEN
    RAISE EXCEPTION 'anonymous flashcard policy is missing or includes class content';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.get_portal_flashcards(uuid)',
    'EXECUTE'
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'anonymous public-list RPC access was lost';
  END IF;
END;
$$;

SELECT 'Lovable security findings RLS smoke passed' AS result;
