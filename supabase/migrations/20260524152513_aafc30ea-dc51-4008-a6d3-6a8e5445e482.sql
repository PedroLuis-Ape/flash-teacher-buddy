-- 1. Drop direct INSERT policy on exchange_logs (no client code writes here)
DROP POLICY IF EXISTS "System can insert exchange logs" ON public.exchange_logs;

-- 2. Drop direct INSERT policy on purchase_logs (no client code writes here)
DROP POLICY IF EXISTS "Users can create their own purchase logs" ON public.purchase_logs;

-- 3. Drop overly broad cross-member profile exposure
DROP POLICY IF EXISTS "Turma members can view each other profiles (safe)" ON public.profiles;

-- 4. Block UPDATE/DELETE on user_roles to prevent privilege escalation by edit
CREATE POLICY "Block user role updates"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Block user role deletes"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);