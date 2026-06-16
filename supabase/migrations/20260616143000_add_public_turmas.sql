-- Public classroom visibility.
-- Access to public content is intentionally served through narrow Edge Functions
-- instead of broad anon RLS policies, preventing accidental exposure of members,
-- progress, messages or future private columns.

ALTER TABLE public.turmas
ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_turmas_public_active
ON public.turmas (created_at DESC)
WHERE public = true AND ativo = true;

COMMENT ON COLUMN public.turmas.public IS
'When true, the classroom metadata and assigned study content may be viewed anonymously in read-only mode.';
