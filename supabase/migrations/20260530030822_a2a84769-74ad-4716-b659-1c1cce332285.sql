-- Security hardening: realtime broadcast lockdown + user_roles client insert guard

-- 1) Lock down realtime.messages (Broadcast/Presence) — app uses only postgres_changes,
-- which is protected by the underlying table RLS. We enable RLS on realtime.messages
-- with no permissive policy, so any broadcast/presence subscription is denied by default.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- (No policies created intentionally → default deny for anon/authenticated.)

-- 2) Enforce at the DB layer that clients can only ever insert role = 'student' into
-- public.user_roles, even if RLS is ever loosened. Server-side admin code runs as
-- service_role and is allowed to bypass this guard.
CREATE OR REPLACE FUNCTION public.enforce_user_roles_client_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- service_role (used by edge functions / admin code) bypasses this guard.
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM 'student'::app_role THEN
    RAISE EXCEPTION 'Only the student role can be self-assigned'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_roles_client_insert ON public.user_roles;
CREATE TRIGGER enforce_user_roles_client_insert
BEFORE INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_roles_client_insert();