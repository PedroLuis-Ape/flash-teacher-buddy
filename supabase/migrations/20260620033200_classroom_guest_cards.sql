CREATE OR REPLACE FUNCTION public.get_portal_flashcards(_list_id uuid)
RETURNS SETOF public.flashcards
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fc.*
  FROM public.flashcards fc
  JOIN public.lists l ON l.id = fc.list_id
  JOIN public.folders f ON f.id = l.folder_id
  JOIN public.profiles p ON p.id = l.owner_id
  WHERE fc.list_id = _list_id
    AND fc.deleted_at IS NULL
    AND l.deleted_at IS NULL
    AND f.deleted_at IS NULL
    AND fc.user_id = l.owner_id
    AND f.owner_id = l.owner_id
    AND (
      (
        l.class_id IS NULL
        AND f.class_id IS NULL
        AND f.visibility = 'class'
        AND COALESCE(p.public_access_enabled, false) = true
      )
      OR
      EXISTS (
        SELECT 1
        FROM public.turmas t
        JOIN public.atribuicoes a ON a.turma_id = t.id
        WHERE t.id = l.class_id
          AND t.owner_teacher_id = l.owner_id
          AND t.public = true
          AND t.ativo = true
          AND (
            (a.fonte_tipo::text = 'lista' AND a.fonte_id = l.id)
            OR
            (
              a.fonte_tipo::text = 'pasta'
              AND a.fonte_id = f.id
              AND f.class_id = t.id
            )
          )
      )
    )
  ORDER BY fc.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_portal_flashcards(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_flashcards(uuid) TO anon, authenticated;
