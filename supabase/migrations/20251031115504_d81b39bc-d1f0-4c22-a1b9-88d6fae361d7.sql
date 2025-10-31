-- Create admin_logs table
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Developer admins can view all logs
CREATE POLICY "Developer admins can view logs"
ON public.admin_logs
FOR SELECT
USING (is_developer_admin(auth.uid()));

-- Developer admins can insert logs
CREATE POLICY "Developer admins can insert logs"
ON public.admin_logs
FOR INSERT
WITH CHECK (is_developer_admin(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_actor_id ON public.admin_logs(actor_id);