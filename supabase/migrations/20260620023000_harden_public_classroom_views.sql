-- Harden public classroom views without granting anonymous access to base tables.
--
-- PostgreSQL views execute with the view owner's privileges by default, which
-- Supabase flags as SECURITY DEFINER VIEW. These views remain narrow and
-- read-only, but the safer shape is:
--   anon/authenticated -> SECURITY INVOKER view -> narrow SECURITY DEFINER SRF
--
-- The SRFs expose only the columns already present in the public views and
-- repeat every ownership/public/active predicate against the base tables.

CREATE OR REPLACE FUNCTION public.public_turmas_rows()
RETURNS TABLE (
  id uuid,
  nome text,
  descricao text,
  created_at timestamptz,
  teacher_name text
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
    t.created_at,
    COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor') AS teacher_name
  FROM public.turmas AS t
  LEFT JOIN public.profiles AS p ON p.id = t.owner_teacher_id
  WHERE t.public = true
    AND t.ativo = true;
$$;

CREATE OR REPLACE FUNCTION public.public_turma_atribuicoes_rows()
RETURNS TABLE (
  id uuid,
  turma_id uuid,
  titulo text,
  descricao text,
  fonte_tipo text,
  order_index integer,
  created_at timestamptz,
  card_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.turma_id,
    a.titulo,
    a.descricao,
    a.fonte_tipo::text AS fonte_tipo,
    a.order_index,
    a.created_at,
    CASE
      WHEN a.fonte_tipo::text = 'lista' THEN (
        SELECT COUNT(*)::integer
        FROM public.lists AS li
        JOIN public.flashcards AS fc ON fc.list_id = li.id
        WHERE li.id = a.fonte_id
          AND li.owner_id = t.owner_teacher_id
          AND li.class_id = t.id
          AND li.visibility = 'class'
          AND li.deleted_at IS NULL
          AND fc.user_id = t.owner_teacher_id
          AND fc.deleted_at IS NULL
      )
      WHEN a.fonte_tipo::text = 'pasta' THEN (
        SELECT COUNT(*)::integer
        FROM public.folders AS fo
        JOIN public.lists AS li ON li.folder_id = fo.id
        JOIN public.flashcards AS fc ON fc.list_id = li.id
        WHERE fo.id = a.fonte_id
          AND fo.owner_id = t.owner_teacher_id
          AND fo.class_id = t.id
          AND fo.visibility = 'class'
          AND fo.deleted_at IS NULL
          AND li.owner_id = t.owner_teacher_id
          AND li.class_id = t.id
          AND li.visibility = 'class'
          AND li.deleted_at IS NULL
          AND fc.user_id = t.owner_teacher_id
          AND fc.deleted_at IS NULL
      )
      ELSE 0
    END AS card_count
  FROM public.atribuicoes AS a
  JOIN public.turmas AS t ON t.id = a.turma_id
  WHERE t.public = true
    AND t.ativo = true;
$$;

CREATE OR REPLACE FUNCTION public.public_turma_lists_rows()
RETURNS TABLE (
  turma_id uuid,
  atribuicao_id uuid,
  list_id uuid,
  title text,
  description text,
  order_index integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.turma_id,
    a.id AS atribuicao_id,
    l.id AS list_id,
    l.title,
    l.description,
    l.order_index
  FROM public.atribuicoes AS a
  JOIN public.turmas AS t
    ON t.id = a.turma_id
   AND t.public = true
   AND t.ativo = true
  JOIN public.lists AS l
    ON a.fonte_tipo::text = 'lista'
   AND l.id = a.fonte_id
   AND l.owner_id = t.owner_teacher_id
   AND l.class_id = t.id
   AND l.visibility = 'class'
  WHERE l.deleted_at IS NULL

  UNION ALL

  SELECT
    a.turma_id,
    a.id AS atribuicao_id,
    l.id AS list_id,
    l.title,
    l.description,
    l.order_index
  FROM public.atribuicoes AS a
  JOIN public.turmas AS t
    ON t.id = a.turma_id
   AND t.public = true
   AND t.ativo = true
  JOIN public.folders AS f
    ON a.fonte_tipo::text = 'pasta'
   AND f.id = a.fonte_id
   AND f.owner_id = t.owner_teacher_id
   AND f.class_id = t.id
   AND f.visibility = 'class'
  JOIN public.lists AS l
    ON l.folder_id = f.id
   AND l.owner_id = t.owner_teacher_id
   AND l.class_id = t.id
   AND l.visibility = 'class'
  WHERE f.deleted_at IS NULL
    AND l.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.public_turma_flashcards_rows()
RETURNS TABLE (
  turma_id uuid,
  atribuicao_id uuid,
  list_id uuid,
  id uuid,
  term text,
  translation text,
  hint text,
  example_text text,
  example_translation text,
  short_explanation text,
  detailed_explanation text,
  image_url_a text,
  image_url_b text,
  audio_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pl.turma_id,
    pl.atribuicao_id,
    pl.list_id,
    fc.id,
    fc.term,
    fc.translation,
    fc.hint,
    fc.example_text,
    fc.example_translation,
    fc.short_explanation,
    fc.detailed_explanation,
    fc.image_url_a,
    fc.image_url_b,
    fc.audio_url,
    fc.created_at
  FROM public.public_turma_lists_rows() AS pl
  JOIN public.turmas AS t
    ON t.id = pl.turma_id
   AND t.public = true
   AND t.ativo = true
  JOIN public.flashcards AS fc
    ON fc.list_id = pl.list_id
   AND fc.user_id = t.owner_teacher_id
  WHERE fc.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.public_turmas_rows() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_turma_atribuicoes_rows() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_turma_lists_rows() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_turma_flashcards_rows() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.public_turmas_rows() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_turma_atribuicoes_rows() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_turma_lists_rows() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_turma_flashcards_rows() TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_turmas
WITH (security_barrier = true, security_invoker = true)
AS
SELECT * FROM public.public_turmas_rows();

CREATE OR REPLACE VIEW public.public_turma_atribuicoes
WITH (security_barrier = true, security_invoker = true)
AS
SELECT * FROM public.public_turma_atribuicoes_rows();

CREATE OR REPLACE VIEW public.public_turma_lists
WITH (security_barrier = true, security_invoker = true)
AS
SELECT * FROM public.public_turma_lists_rows();

CREATE OR REPLACE VIEW public.public_turma_flashcards
WITH (security_barrier = true, security_invoker = true)
AS
SELECT * FROM public.public_turma_flashcards_rows();

REVOKE ALL ON public.public_turmas FROM PUBLIC;
REVOKE ALL ON public.public_turma_atribuicoes FROM PUBLIC;
REVOKE ALL ON public.public_turma_lists FROM PUBLIC;
REVOKE ALL ON public.public_turma_flashcards FROM PUBLIC;

GRANT SELECT ON public.public_turmas TO anon, authenticated;
GRANT SELECT ON public.public_turma_atribuicoes TO anon, authenticated;
GRANT SELECT ON public.public_turma_lists TO anon, authenticated;
GRANT SELECT ON public.public_turma_flashcards TO anon, authenticated;

COMMENT ON FUNCTION public.public_turmas_rows() IS
  'Returns only active public classroom metadata for the security-invoker public_turmas view.';
COMMENT ON FUNCTION public.public_turma_atribuicoes_rows() IS
  'Returns only assignments belonging to active public classrooms.';
COMMENT ON FUNCTION public.public_turma_lists_rows() IS
  'Returns only owner-validated class-visible lists assigned to active public classrooms.';
COMMENT ON FUNCTION public.public_turma_flashcards_rows() IS
  'Returns only owner-validated cards from lists exposed by active public classrooms.';
