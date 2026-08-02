ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS session_scope_key text,
  ADD COLUMN IF NOT EXISTS session_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS settings_snapshot jsonb;

CREATE INDEX IF NOT EXISTS study_sessions_scope_key_idx
  ON public.study_sessions (user_id, session_scope_key)
  WHERE session_scope_key IS NOT NULL;