-- Compatibility layer after public learning-resource discovery.
-- Restores the latest classroom guest-play contract and canonical principal-card
-- counters while retaining stricter public-folder boundaries.

CREATE OR REPLACE FUNCTION public.get_portal_lists_with_counts(_folder_id uuid)
RETURNS TABLE (
  id uuid,
  folder_id uuid,
  owner_id uuid,
  title text,
  description text,
  order_index integer,
  visibility text,
  lang text,
  class_id uuid,
  institution_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    l.id,
    l.folder_id,
    l.owner_id,
    l.title,
    l.description,
    l.order_index,
    l.visibility,
    l.lang,
    l.class_id,
    l.institution_id,
    l.created_at,
    l.updated_at,
    COUNT(fc.id)::bigint AS card_count
  FROM public.lists l
  JOIN public.folders folder ON folder.id = l.folder_id
  JOIN public.profiles profile ON profile.id = folder.owner_id
  LEFT JOIN public.flashcards fc
    ON fc.list_id = l.id
   AND fc.deleted_at IS NULL
   AND fc.parent_card_id IS NULL
   AND fc.user_id = folder.owner_id
  WHERE l.folder_id = _folder_id
    AND l.owner_id = folder.owner_id
    AND l.visibility = 'class'
    AND l.class_id IS NULL
    AND l.deleted_at IS NULL
    AND folder.visibility = 'class'
    AND folder.class_id IS NULL
    AND folder.deleted_at IS NULL
    AND COALESCE(profile.public_access_enabled, false) = true
  GROUP BY l.id
  ORDER BY l.order_index ASC NULLS LAST, l.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_counts(_folder_id uuid)
RETURNS TABLE(list_count integer, card_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COUNT(DISTINCT l.id)::integer AS list_count,
    COUNT(DISTINCT fc.id)::integer AS card_count
  FROM public.folders folder
  JOIN public.profiles profile ON profile.id = folder.owner_id
  LEFT JOIN public.lists l
    ON l.folder_id = folder.id
   AND l.owner_id = folder.owner_id
   AND l.visibility = 'class'
   AND l.class_id IS NULL
   AND l.deleted_at IS NULL
  LEFT JOIN public.flashcards fc
    ON fc.list_id = l.id
   AND fc.user_id = folder.owner_id
   AND fc.deleted_at IS NULL
   AND fc.parent_card_id IS NULL
  WHERE folder.id = _folder_id
    AND folder.visibility = 'class'
    AND folder.class_id IS NULL
    AND folder.deleted_at IS NULL
    AND COALESCE(profile.public_access_enabled, false) = true;
$$;

-- This function has two legitimate anonymous paths:
-- 1) a teacher-owned public folder outside classroom context;
-- 2) a list or folder explicitly assigned to an active public classroom.
CREATE OR REPLACE FUNCTION public.get_portal_flashcards(_list_id uuid)
RETURNS SETOF public.flashcards
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fc.*
  FROM public.flashcards AS fc
  JOIN public.lists AS l ON l.id = fc.list_id
  JOIN public.folders AS f ON f.id = l.folder_id
  JOIN public.profiles AS p ON p.id = l.owner_id
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
        AND l.visibility = 'class'
        AND f.visibility = 'class'
        AND COALESCE(p.public_access_enabled, false) = true
      )
      OR
      EXISTS (
        SELECT 1
        FROM public.turmas AS t
        JOIN public.atribuicoes AS a ON a.turma_id = t.id
        WHERE t.owner_teacher_id = l.owner_id
          AND t.public = true
          AND t.ativo = true
          AND (
            (a.fonte_tipo::text = 'lista' AND a.fonte_id = l.id)
            OR
            (
              a.fonte_tipo::text = 'pasta'
              AND a.fonte_id = f.id
              AND f.owner_id = t.owner_teacher_id
              AND l.owner_id = t.owner_teacher_id
            )
          )
      )
    )
  ORDER BY fc.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_portal_lists_with_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_portal_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_portal_flashcards(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_portal_lists_with_counts(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_counts(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_flashcards(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_portal_flashcards(uuid) IS
  'Anonymous cards for either canonical public folders or explicit active public-classroom assignments.';
