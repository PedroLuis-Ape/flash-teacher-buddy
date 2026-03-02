-- Fix 5 permissive RLS policies that use WITH CHECK (true)

-- 1. atribuicoes_status: Only allow users to insert their own status
DROP POLICY IF EXISTS "System can insert atribuicoes_status" ON public.atribuicoes_status;
CREATE POLICY "Users can insert their own atribuicoes_status"
  ON public.atribuicoes_status
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = aluno_id);

-- 2. ingest_logs: Only admin should write
DROP POLICY IF EXISTS "System can insert ingest logs" ON public.ingest_logs;
CREATE POLICY "Only admins can insert ingest_logs"
  ON public.ingest_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_developer_admin(auth.uid()));

-- 3. notificacoes: Users can only insert notifications for themselves
DROP POLICY IF EXISTS "System can insert notifications" ON public.notificacoes;
CREATE POLICY "Users can insert own notifications"
  ON public.notificacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = recipient_id);

-- 4. notifications: Users can only insert their own notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. quarantine_logs: Only admin should write
DROP POLICY IF EXISTS "System can insert quarantine logs" ON public.quarantine_logs;
CREATE POLICY "Only admins can insert quarantine_logs"
  ON public.quarantine_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_developer_admin(auth.uid()));