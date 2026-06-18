-- Reuse the anonymous public classroom view for teacher public profiles.
-- This migration does not create a new RPC and does not grant any new access.
-- It only appends profile linkage and aggregate counts to public.public_turmas,
-- whose read-only anon/authenticated permissions already come from
-- 20260616143000_add_public_turmas.sql.

DO $$
BEGIN
  IF to_regclass('public.public_turmas') IS NULL
     OR to_regclass('public.public_turma_atribuicoes') IS NULL
     OR to_regclass('public.public_turma_flashcards') IS NULL THEN
    RAISE EXCEPTION
      'Public classroom views are missing. Apply 20260616143000_add_public_turmas.sql first.';
  END IF;

  IF EXISTS (
    SELECT required.column_name
    FROM (
      VALUES
        ('is_teacher'),
        ('public_access_enabled'),
        ('public_profile_searchable'),
        ('public_slug')
    ) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns columns
      WHERE columns.table_schema = 'public'
        AND columns.table_name = 'profiles'
        AND columns.column_name = required.column_name
    )
  ) THEN
    RAISE EXCEPTION
      'One or more public teacher profile columns are missing. Apply the public directory migrations first.';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_turmas_public_owner_active
  ON public.turmas (owner_teacher_id, created_at DESC)
  WHERE public = true AND ativo = true;

CREATE OR REPLACE VIEW public.public_turmas
WITH (security_barrier = true)
AS
SELECT
  t.id,
  t.nome,
  t.descricao,
  t.created_at,
  COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor') AS teacher_name,
  CASE
    WHEN COALESCE(p.is_teacher, false) = true
      AND COALESCE(p.public_access_enabled, false) = true
      AND COALESCE(p.public_profile_searchable, false) = true
      AND p.public_slug IS NOT NULL
      AND BTRIM(p.public_slug) <> ''
    THEN LOWER(BTRIM(p.public_slug))
    ELSE NULL
  END AS teacher_public_slug,
  (
    SELECT COUNT(*)
    FROM public.public_turma_atribuicoes pta
    WHERE pta.turma_id = t.id
  ) AS assignment_count,
  (
    SELECT COUNT(*)
    FROM public.public_turma_flashcards ptf
    WHERE ptf.turma_id = t.id
  ) AS card_count
FROM public.turmas t
LEFT JOIN public.profiles p
  ON p.id = t.owner_teacher_id
WHERE t.public = true
  AND t.ativo = true;

COMMENT ON VIEW public.public_turmas IS
  'Read-only public classroom projection reused by anonymous classroom pages and discoverable teacher profiles.';

COMMENT ON COLUMN public.public_turmas.teacher_public_slug IS
  'Normalized teacher slug only when the teacher public profile is enabled and searchable; otherwise null.';

COMMENT ON COLUMN public.public_turmas.assignment_count IS
  'Count derived from the existing anonymous public classroom assignment view.';

COMMENT ON COLUMN public.public_turmas.card_count IS
  'Count derived from the existing anonymous public classroom flashcard view.';
