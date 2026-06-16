-- Etapa 5: sincronização opcional do histórico do Portal Público.
-- Usa uma sessão anônima isolada do login principal e RLS owner-only.
-- Nenhum IP, fingerprint ou código secreto próprio é armazenado.

CREATE TABLE IF NOT EXISTS public.anonymous_portal_history (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  CONSTRAINT anonymous_portal_history_is_array CHECK (jsonb_typeof(history) = 'array'),
  CONSTRAINT anonymous_portal_history_max_items CHECK (jsonb_array_length(history) <= 12),
  CONSTRAINT anonymous_portal_history_max_size CHECK (pg_column_size(history) <= 32768)
);

CREATE INDEX IF NOT EXISTS anonymous_portal_history_expires_idx
  ON public.anonymous_portal_history (expires_at);

CREATE TABLE IF NOT EXISTS public.user_portal_history (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_portal_history_is_array CHECK (jsonb_typeof(history) = 'array'),
  CONSTRAINT user_portal_history_max_items CHECK (jsonb_array_length(history) <= 12),
  CONSTRAINT user_portal_history_max_size CHECK (pg_column_size(history) <= 32768)
);

ALTER TABLE public.anonymous_portal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_portal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anonymous session reads own portal history" ON public.anonymous_portal_history;
CREATE POLICY "Anonymous session reads own portal history"
ON public.anonymous_portal_history
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = true
  AND expires_at > now()
);

DROP POLICY IF EXISTS "Anonymous session inserts own portal history" ON public.anonymous_portal_history;
CREATE POLICY "Anonymous session inserts own portal history"
ON public.anonymous_portal_history
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = true
  AND expires_at > now()
  AND expires_at <= now() + interval '91 days'
);

DROP POLICY IF EXISTS "Anonymous session updates own portal history" ON public.anonymous_portal_history;
CREATE POLICY "Anonymous session updates own portal history"
ON public.anonymous_portal_history
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = true
  AND expires_at > now()
)
WITH CHECK (
  owner_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = true
  AND expires_at > now()
  AND expires_at <= now() + interval '91 days'
);

DROP POLICY IF EXISTS "Anonymous session deletes own portal history" ON public.anonymous_portal_history;
CREATE POLICY "Anonymous session deletes own portal history"
ON public.anonymous_portal_history
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = true
);

DROP POLICY IF EXISTS "Permanent user reads own portal history" ON public.user_portal_history;
CREATE POLICY "Permanent user reads own portal history"
ON public.user_portal_history
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = false
);

DROP POLICY IF EXISTS "Permanent user inserts own portal history" ON public.user_portal_history;
CREATE POLICY "Permanent user inserts own portal history"
ON public.user_portal_history
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = false
);

DROP POLICY IF EXISTS "Permanent user updates own portal history" ON public.user_portal_history;
CREATE POLICY "Permanent user updates own portal history"
ON public.user_portal_history
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = false
)
WITH CHECK (
  user_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = false
);

DROP POLICY IF EXISTS "Permanent user deletes own portal history" ON public.user_portal_history;
CREATE POLICY "Permanent user deletes own portal history"
ON public.user_portal_history
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = false
);

REVOKE ALL ON public.anonymous_portal_history FROM anon;
REVOKE ALL ON public.user_portal_history FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anonymous_portal_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_portal_history TO authenticated;
