-- Public classroom visibility.
-- Anonymous access is exposed only through narrow read-only views. Every
-- content view verifies that the assigned source belongs to the classroom
-- owner and was copied specifically for that classroom.

ALTER TABLE public.turmas
ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_turmas_public_active
ON public.turmas (created_at DESC)
WHERE public = true AND ativo = true;

COMMENT ON COLUMN public.turmas.public IS
'When true, classroom metadata and assigned study content may be viewed anonymously in read-only mode.';

CREATE OR REPLACE VIEW public.public_turmas
WITH (security_barrier = true)
AS
SELECT
  t.id,
  t.nome,
  t.descricao,
  t.created_at,
  COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor') AS teacher_name
FROM public.turmas t
LEFT JOIN public.profiles p ON p.id = t.owner_teacher_id
WHERE t.public = true
  AND t.ativo = true;

CREATE OR REPLACE VIEW public.public_turma_atribuicoes
WITH (security_barrier = true)
AS
SELECT
  a.id,
  a.turma_id,
  a.titulo,
  a.descricao,
  a.fonte_tipo::TEXT AS fonte_tipo,
  a.order_index,
  a.created_at,
  CASE
    WHEN a.fonte_tipo::TEXT = 'lista' THEN (
      SELECT COUNT(*)::INTEGER
      FROM public.lists li
      JOIN public.flashcards fc ON fc.list_id = li.id
      WHERE li.id = a.fonte_id
        AND li.owner_id = t.owner_teacher_id
        AND li.class_id = t.id
        AND li.visibility = 'class'
        AND li.deleted_at IS NULL
        AND fc.user_id = t.owner_teacher_id
        AND fc.deleted_at IS NULL
    )
    WHEN a.fonte_tipo::TEXT = 'pasta' THEN (
      SELECT COUNT(*)::INTEGER
      FROM public.folders fo
      JOIN public.lists li ON li.folder_id = fo.id
      JOIN public.flashcards fc ON fc.list_id = li.id
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
FROM public.atribuicoes a
JOIN public.turmas t ON t.id = a.turma_id
WHERE t.public = true
  AND t.ativo = true;

CREATE OR REPLACE VIEW public.public_turma_lists
WITH (security_barrier = true)
AS
SELECT
  a.turma_id,
  a.id AS atribuicao_id,
  l.id AS list_id,
  l.title,
  l.description,
  l.order_index
FROM public.atribuicoes a
JOIN public.turmas t
  ON t.id = a.turma_id
 AND t.public = true
 AND t.ativo = true
JOIN public.lists l
  ON a.fonte_tipo::TEXT = 'lista'
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
FROM public.atribuicoes a
JOIN public.turmas t
  ON t.id = a.turma_id
 AND t.public = true
 AND t.ativo = true
JOIN public.folders f
  ON a.fonte_tipo::TEXT = 'pasta'
 AND f.id = a.fonte_id
 AND f.owner_id = t.owner_teacher_id
 AND f.class_id = t.id
 AND f.visibility = 'class'
JOIN public.lists l
  ON l.folder_id = f.id
 AND l.owner_id = t.owner_teacher_id
 AND l.class_id = t.id
 AND l.visibility = 'class'
WHERE f.deleted_at IS NULL
  AND l.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.public_turma_flashcards
WITH (security_barrier = true)
AS
SELECT
  pl.turma_id,
  pl.atribuicao_id,
  pl.list_id,
  f.id,
  f.term,
  f.translation,
  f.hint,
  f.example_text,
  f.example_translation,
  f.short_explanation,
  f.detailed_explanation,
  f.image_url_a,
  f.image_url_b,
  f.audio_url,
  f.created_at
FROM public.public_turma_lists pl
JOIN public.turmas t
  ON t.id = pl.turma_id
 AND t.public = true
 AND t.ativo = true
JOIN public.flashcards f
  ON f.list_id = pl.list_id
 AND f.user_id = t.owner_teacher_id
WHERE f.deleted_at IS NULL;

REVOKE ALL ON public.public_turmas FROM PUBLIC;
REVOKE ALL ON public.public_turma_atribuicoes FROM PUBLIC;
REVOKE ALL ON public.public_turma_lists FROM PUBLIC;
REVOKE ALL ON public.public_turma_flashcards FROM PUBLIC;

GRANT SELECT ON public.public_turmas TO anon, authenticated;
GRANT SELECT ON public.public_turma_atribuicoes TO anon, authenticated;
GRANT SELECT ON public.public_turma_lists TO anon, authenticated;
GRANT SELECT ON public.public_turma_flashcards TO anon, authenticated;
