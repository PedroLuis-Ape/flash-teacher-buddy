-- Public classes shown on the anonymous teacher profile.
-- The function exposes only classroom metadata and aggregate counts already
-- available through the narrow public classroom views.

CREATE OR REPLACE FUNCTION public.get_public_teacher_turmas(_slug text)
RETURNS TABLE (
  id uuid,
  nome text,
  descricao text,
  assignment_count bigint,
  card_count bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.nome,
    t.descricao,
    (
      SELECT COUNT(*)
      FROM public.public_turma_atribuicoes pa
      WHERE pa.turma_id = t.id
    ) AS assignment_count,
    (
      SELECT COUNT(*)
      FROM public.public_turma_flashcards pf
      WHERE pf.turma_id = t.id
    ) AS card_count,
    t.created_at
  FROM public.profiles p
  JOIN public.turmas t ON t.owner_teacher_id = p.id
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND COALESCE(p.public_profile_searchable, false) = true
    AND p.public_slug IS NOT NULL
    AND LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(COALESCE(_slug, '')))
    AND t.public = true
    AND t.ativo = true
  ORDER BY t.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_teacher_turmas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_turmas(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_teacher_turmas(text) IS
  'Returns active public classrooms for a public teacher slug without exposing ownership, membership, email, progress, or administrative data.';
