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
    a.fonte_tipo::text,
    a.order_index,
    a.created_at,
    CASE
      WHEN a.fonte_tipo::text = 'lista' THEN (
        SELECT COUNT(*)::integer
        FROM public.lists li
        JOIN public.flashcards fc ON fc.list_id = li.id
        WHERE li.id = a.fonte_id
          AND li.owner_id = t.owner_teacher_id
          AND li.class_id = t.id
          AND li.deleted_at IS NULL
          AND fc.user_id = t.owner_teacher_id
          AND fc.deleted_at IS NULL
      )
      WHEN a.fonte_tipo::text = 'pasta' THEN (
        SELECT COUNT(*)::integer
        FROM public.folders fo
        JOIN public.lists li ON li.folder_id = fo.id
        JOIN public.flashcards fc ON fc.list_id = li.id
        WHERE fo.id = a.fonte_id
          AND fo.owner_id = t.owner_teacher_id
          AND fo.class_id = t.id
          AND fo.deleted_at IS NULL
          AND li.owner_id = t.owner_teacher_id
          AND li.class_id = t.id
          AND li.deleted_at IS NULL
          AND fc.user_id = t.owner_teacher_id
          AND fc.deleted_at IS NULL
      )
      ELSE 0
    END
  FROM public.atribuicoes a
  JOIN public.turmas t ON t.id = a.turma_id
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
    a.id,
    l.id,
    l.title,
    l.description,
    l.order_index
  FROM public.atribuicoes a
  JOIN public.turmas t
    ON t.id = a.turma_id
   AND t.public = true
   AND t.ativo = true
  JOIN public.lists l
    ON a.fonte_tipo::text = 'lista'
   AND l.id = a.fonte_id
   AND l.owner_id = t.owner_teacher_id
   AND l.class_id = t.id
  WHERE l.deleted_at IS NULL

  UNION ALL

  SELECT
    a.turma_id,
    a.id,
    l.id,
    l.title,
    l.description,
    l.order_index
  FROM public.atribuicoes a
  JOIN public.turmas t
    ON t.id = a.turma_id
   AND t.public = true
   AND t.ativo = true
  JOIN public.folders f
    ON a.fonte_tipo::text = 'pasta'
   AND f.id = a.fonte_id
   AND f.owner_id = t.owner_teacher_id
   AND f.class_id = t.id
  JOIN public.lists l
    ON l.folder_id = f.id
   AND l.owner_id = t.owner_teacher_id
   AND l.class_id = t.id
  WHERE f.deleted_at IS NULL
    AND l.deleted_at IS NULL;
$$;
