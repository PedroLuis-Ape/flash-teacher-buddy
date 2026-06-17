-- Connect public teacher profiles to their public classrooms.
-- The deployment guard intentionally fails loudly when the prerequisite
-- public-directory or public-classroom migrations were not applied.

DO $$
BEGIN
  IF to_regprocedure('public.search_public_teachers(text,integer)') IS NULL
     OR to_regprocedure('public.get_public_teacher_profile(text)') IS NULL
     OR to_regprocedure('public.get_public_teacher_folders(text)') IS NULL THEN
    RAISE EXCEPTION
      'Public teacher directory migrations are missing. Apply 20260616192000 and 20260616195500 first.';
  END IF;

  IF to_regclass('public.public_turma_atribuicoes') IS NULL
     OR to_regclass('public.public_turma_flashcards') IS NULL THEN
    RAISE EXCEPTION
      'Public classroom views are missing. Apply 20260616143000_add_public_turmas.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'turmas'
      AND column_name = 'public'
  ) THEN
    RAISE EXCEPTION
      'public.turmas.public is missing. Apply 20260616143000_add_public_turmas.sql first.';
  END IF;

  IF EXISTS (
    SELECT required.column_name
    FROM (
      VALUES
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

CREATE OR REPLACE FUNCTION public.get_public_teacher_turmas(_slug text)
RETURNS TABLE (
  id uuid,
  nome text,
  descricao text,
  created_at timestamptz,
  assignment_count bigint,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH public_teacher AS (
    SELECT p.id
    FROM public.profiles p
    WHERE COALESCE(p.is_teacher, false) = true
      AND COALESCE(p.public_access_enabled, false) = true
      AND COALESCE(p.public_profile_searchable, false) = true
      AND p.public_slug IS NOT NULL
      AND BTRIM(p.public_slug) <> ''
      AND LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(COALESCE(_slug, '')))
    LIMIT 1
  )
  SELECT
    t.id,
    t.nome,
    t.descricao,
    t.created_at,
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
  FROM public_teacher teacher
  JOIN public.turmas t
    ON t.owner_teacher_id = teacher.id
  WHERE t.public = true
    AND t.ativo = true
  ORDER BY t.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_public_teacher_turmas(text) IS
  'Lists only active public classrooms belonging to a discoverable public teacher profile, with counts derived from anonymous public classroom views.';

REVOKE ALL ON FUNCTION public.get_public_teacher_turmas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_turmas(text) TO anon, authenticated;
