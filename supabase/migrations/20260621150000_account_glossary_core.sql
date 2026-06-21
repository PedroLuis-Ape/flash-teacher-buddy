BEGIN;

CREATE TABLE IF NOT EXISTS public.account_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text text NOT NULL CHECK (btrim(original_text) <> ''),
  translated_text text NOT NULL CHECK (btrim(translated_text) <> ''),
  note text,
  side text NOT NULL DEFAULT 'A' CHECK (side IN ('A', 'B')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_glossary_exact_identity
ON public.account_glossary (
  owner_id,
  side,
  lower(btrim(original_text)),
  lower(btrim(translated_text))
);

CREATE INDEX IF NOT EXISTS idx_account_glossary_owner_active
ON public.account_glossary(owner_id, is_active);

CREATE INDEX IF NOT EXISTS idx_account_glossary_owner_original
ON public.account_glossary(owner_id, side, lower(btrim(original_text)));

ALTER TABLE public.account_glossary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_glossary_owner_select ON public.account_glossary;
CREATE POLICY account_glossary_owner_select
ON public.account_glossary FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS account_glossary_owner_insert ON public.account_glossary;
CREATE POLICY account_glossary_owner_insert
ON public.account_glossary FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS account_glossary_owner_update ON public.account_glossary;
CREATE POLICY account_glossary_owner_update
ON public.account_glossary FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS account_glossary_owner_delete ON public.account_glossary;
CREATE POLICY account_glossary_owner_delete
ON public.account_glossary FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_glossary TO authenticated;

INSERT INTO public.account_glossary (
  owner_id, original_text, translated_text, note,
  side, is_active, created_at, updated_at
)
SELECT DISTINCT ON (
  l.owner_id,
  g.side,
  lower(btrim(g.original_text)),
  lower(btrim(g.translated_text))
)
  l.owner_id,
  btrim(g.original_text),
  btrim(g.translated_text),
  g.note,
  g.side,
  g.is_active,
  g.created_at,
  g.updated_at
FROM public.list_glossary g
JOIN public.lists l ON l.id = g.list_id
WHERE l.deleted_at IS NULL
  AND btrim(g.original_text) <> ''
  AND btrim(g.translated_text) <> ''
ORDER BY
  l.owner_id,
  g.side,
  lower(btrim(g.original_text)),
  lower(btrim(g.translated_text)),
  g.updated_at DESC,
  g.id DESC
ON CONFLICT (
  owner_id,
  side,
  lower(btrim(original_text)),
  lower(btrim(translated_text))
)
DO UPDATE SET
  note = COALESCE(EXCLUDED.note, account_glossary.note),
  is_active = account_glossary.is_active OR EXCLUDED.is_active,
  updated_at = GREATEST(account_glossary.updated_at, EXCLUDED.updated_at);

COMMIT;
