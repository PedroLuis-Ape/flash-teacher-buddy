-- Run after applying 20260801203951_portal_playable_card_count.sql.
-- Read-only structural smoke; it does not create, update or delete user data.

DO $$
DECLARE
  v_function regprocedure := to_regprocedure('public.get_portal_playable_card_count(uuid)');
  v_security_definer boolean;
  v_config text[];
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'Missing public.get_portal_playable_card_count(uuid)';
  END IF;

  SELECT prosecdef, proconfig
    INTO v_security_definer, v_config
  FROM pg_proc
  WHERE oid = v_function;

  IF NOT v_security_definer THEN
    RAISE EXCEPTION 'Portal count authority must be SECURITY DEFINER';
  END IF;

  IF NOT ('search_path=public, pg_temp' = ANY (COALESCE(v_config, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'Portal count authority must fix search_path';
  END IF;

  IF NOT has_function_privilege('anon', v_function, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'Portal count authority requires explicit anon/authenticated grants';
  END IF;
END;
$$;
