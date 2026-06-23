CREATE OR REPLACE FUNCTION public.enforce_user_roles_client_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- A direct table insert fires this trigger at depth 1.
  -- The canonical auth.users signup trigger inserts the role at depth 2.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM 'student'::public.app_role THEN
    RAISE EXCEPTION 'Only the student role can be self-assigned'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
