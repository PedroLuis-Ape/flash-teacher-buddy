
CREATE OR REPLACE FUNCTION public.get_user_card_counts(_user_id uuid, _institution_id uuid DEFAULT NULL)
RETURNS TABLE(list_id uuid, card_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT f.list_id, COUNT(*)::bigint AS card_count
  FROM public.flashcards f
  JOIN public.lists l ON l.id = f.list_id
  WHERE l.owner_id = _user_id
    AND l.class_id IS NULL
    AND l.deleted_at IS NULL
    AND f.deleted_at IS NULL
    AND (
      (_institution_id IS NULL AND l.institution_id IS NULL)
      OR l.institution_id = _institution_id
    )
  GROUP BY f.list_id;
$$;
