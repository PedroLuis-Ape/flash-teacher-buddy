BEGIN;

-- ============================================================
-- 1) Recently used lists inside a folder
-- ============================================================
-- A list is considered recent for the current user when it was opened or
-- studied. The extra last_activity field is consumed by the existing natural
-- sorter, so recent lists rise to the top while untouched lists keep their
-- persisted order/title fallback.
DROP FUNCTION IF EXISTS public.get_lists_with_card_counts(uuid);

CREATE FUNCTION public.get_lists_with_card_counts(_folder_id uuid)
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
  card_count bigint,
  last_activity timestamptz
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
    COUNT(fc.id)::bigint AS card_count,
    GREATEST(activity.last_studied_at, activity.last_opened_at) AS last_activity
  FROM public.lists l
  LEFT JOIN public.flashcards fc
    ON fc.list_id = l.id
   AND fc.deleted_at IS NULL
   AND fc.parent_card_id IS NULL
  LEFT JOIN public.user_list_activity activity
    ON activity.list_id = l.id
   AND activity.user_id = auth.uid()
  WHERE l.folder_id = _folder_id
    AND l.deleted_at IS NULL
  GROUP BY
    l.id,
    activity.last_studied_at,
    activity.last_opened_at
  ORDER BY
    last_activity DESC NULLS LAST,
    l.order_index ASC NULLS LAST,
    l.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_lists_with_card_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lists_with_card_counts(uuid) TO authenticated;

-- ============================================================
-- 2) Canonical visible-card counts
-- ============================================================
-- The interface renders a principal card plus its internal layers as one card.
-- Therefore every general counter must count only active principal rows
-- (parent_card_id IS NULL), never deleted rows or internal layers.
CREATE OR REPLACE FUNCTION public.get_user_card_counts(
  _user_id uuid,
  _institution_id uuid DEFAULT NULL
)
RETURNS TABLE(list_id uuid, card_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT fc.list_id, COUNT(*)::bigint AS card_count
  FROM public.flashcards fc
  JOIN public.lists l ON l.id = fc.list_id
  WHERE l.owner_id = _user_id
    AND l.class_id IS NULL
    AND l.deleted_at IS NULL
    AND fc.deleted_at IS NULL
    AND fc.parent_card_id IS NULL
    AND (
      (_institution_id IS NULL AND l.institution_id IS NULL)
      OR l.institution_id = _institution_id
    )
  GROUP BY fc.list_id;
$$;

REVOKE ALL ON FUNCTION public.get_user_card_counts(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_card_counts(uuid, uuid) TO authenticated;

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
  WHERE l.folder_id = _folder_id
    AND l.deleted_at IS NULL
    AND folder.visibility = 'class'
    AND folder.deleted_at IS NULL
    AND COALESCE(profile.public_access_enabled, false) = true
  GROUP BY l.id
  ORDER BY l.order_index ASC NULLS LAST, l.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_portal_lists_with_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_lists_with_counts(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_portal_counts(_folder_id uuid)
RETURNS TABLE(list_count integer, card_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (
      SELECT COUNT(*)
      FROM public.lists l
      JOIN public.folders folder ON folder.id = l.folder_id
      JOIN public.profiles profile ON profile.id = folder.owner_id
      WHERE l.folder_id = _folder_id
        AND l.deleted_at IS NULL
        AND folder.visibility = 'class'
        AND folder.deleted_at IS NULL
        AND COALESCE(profile.public_access_enabled, false) = true
    )::integer AS list_count,
    (
      SELECT COUNT(*)
      FROM public.flashcards fc
      JOIN public.lists l ON l.id = fc.list_id
      JOIN public.folders folder ON folder.id = l.folder_id
      JOIN public.profiles profile ON profile.id = folder.owner_id
      WHERE l.folder_id = _folder_id
        AND fc.deleted_at IS NULL
        AND fc.parent_card_id IS NULL
        AND l.deleted_at IS NULL
        AND folder.visibility = 'class'
        AND folder.deleted_at IS NULL
        AND COALESCE(profile.public_access_enabled, false) = true
    )::integer AS card_count;
$$;

REVOKE ALL ON FUNCTION public.get_portal_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_counts(uuid) TO anon, authenticated;

-- ============================================================
-- 3) Public classroom counters
-- ============================================================
CREATE OR REPLACE VIEW public.public_turma_atribuicoes
WITH (security_barrier = true)
AS
SELECT
  assignment.id,
  assignment.turma_id,
  assignment.titulo,
  assignment.descricao,
  assignment.fonte_tipo::text AS fonte_tipo,
  assignment.order_index,
  assignment.created_at,
  CASE
    WHEN assignment.fonte_tipo::text = 'lista' THEN (
      SELECT COUNT(*)::integer
      FROM public.lists list_row
      JOIN public.flashcards card ON card.list_id = list_row.id
      WHERE list_row.id = assignment.fonte_id
        AND list_row.owner_id = classroom.owner_teacher_id
        AND list_row.class_id = classroom.id
        AND list_row.visibility = 'class'
        AND list_row.deleted_at IS NULL
        AND card.user_id = classroom.owner_teacher_id
        AND card.deleted_at IS NULL
        AND card.parent_card_id IS NULL
    )
    WHEN assignment.fonte_tipo::text = 'pasta' THEN (
      SELECT COUNT(*)::integer
      FROM public.folders folder
      JOIN public.lists list_row ON list_row.folder_id = folder.id
      JOIN public.flashcards card ON card.list_id = list_row.id
      WHERE folder.id = assignment.fonte_id
        AND folder.owner_id = classroom.owner_teacher_id
        AND folder.class_id = classroom.id
        AND folder.visibility = 'class'
        AND folder.deleted_at IS NULL
        AND list_row.owner_id = classroom.owner_teacher_id
        AND list_row.class_id = classroom.id
        AND list_row.visibility = 'class'
        AND list_row.deleted_at IS NULL
        AND card.user_id = classroom.owner_teacher_id
        AND card.deleted_at IS NULL
        AND card.parent_card_id IS NULL
    )
    ELSE 0
  END AS card_count
FROM public.atribuicoes assignment
JOIN public.turmas classroom ON classroom.id = assignment.turma_id
WHERE classroom.public = true
  AND classroom.ativo = true;

REVOKE ALL ON public.public_turma_atribuicoes FROM PUBLIC;
GRANT SELECT ON public.public_turma_atribuicoes TO anon, authenticated;

-- ============================================================
-- 4) Public teacher directory/profile counters
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_public_teachers(
  _q text DEFAULT '',
  _limit integer DEFAULT 12
)
RETURNS TABLE (
  display_name text,
  avatar_url text,
  public_slug text,
  public_bio text,
  public_specialties text[],
  folder_count bigint,
  list_count bigint,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    CASE
      WHEN LOWER(COALESCE(NULLIF(BTRIM(profile.first_name), ''), 'Professor')) LIKE 'professor %'
        THEN COALESCE(NULLIF(BTRIM(profile.first_name), ''), 'Professor')
      ELSE 'Professor ' || COALESCE(NULLIF(BTRIM(profile.first_name), ''), 'Professor')
    END AS display_name,
    profile.avatar_url,
    profile.public_slug,
    NULLIF(BTRIM(profile.public_bio), '') AS public_bio,
    COALESCE(profile.public_specialties, ARRAY[]::text[]) AS public_specialties,
    (
      SELECT COUNT(*)
      FROM public.folders folder
      WHERE folder.owner_id = profile.id
        AND folder.visibility = 'class'
        AND folder.class_id IS NULL
        AND folder.deleted_at IS NULL
    ) AS folder_count,
    (
      SELECT COUNT(*)
      FROM public.folders folder
      JOIN public.lists list_row ON list_row.folder_id = folder.id
      WHERE folder.owner_id = profile.id
        AND folder.visibility = 'class'
        AND folder.class_id IS NULL
        AND folder.deleted_at IS NULL
        AND list_row.owner_id = profile.id
        AND list_row.visibility = 'class'
        AND list_row.class_id IS NULL
        AND list_row.deleted_at IS NULL
    ) AS list_count,
    (
      SELECT COUNT(*)
      FROM public.folders folder
      JOIN public.lists list_row ON list_row.folder_id = folder.id
      JOIN public.flashcards card ON card.list_id = list_row.id
      WHERE folder.owner_id = profile.id
        AND folder.visibility = 'class'
        AND folder.class_id IS NULL
        AND folder.deleted_at IS NULL
        AND list_row.owner_id = profile.id
        AND list_row.visibility = 'class'
        AND list_row.class_id IS NULL
        AND list_row.deleted_at IS NULL
        AND card.user_id = profile.id
        AND card.deleted_at IS NULL
        AND card.parent_card_id IS NULL
    ) AS card_count
  FROM public.profiles profile
  WHERE COALESCE(profile.is_teacher, false) = true
    AND COALESCE(profile.public_access_enabled, false) = true
    AND profile.public_profile_searchable = true
    AND profile.public_slug IS NOT NULL
    AND BTRIM(profile.public_slug) <> ''
    AND (
      BTRIM(COALESCE(_q, '')) = ''
      OR profile.first_name ILIKE '%' || BTRIM(_q) || '%'
      OR profile.public_slug ILIKE '%' || BTRIM(_q) || '%'
      OR COALESCE(profile.public_bio, '') ILIKE '%' || BTRIM(_q) || '%'
      OR EXISTS (
        SELECT 1
        FROM UNNEST(COALESCE(profile.public_specialties, ARRAY[]::text[])) AS specialty
        WHERE specialty ILIKE '%' || BTRIM(_q) || '%'
      )
    )
  ORDER BY
    CASE WHEN LOWER(COALESCE(profile.first_name, '')) = LOWER(BTRIM(COALESCE(_q, ''))) THEN 0 ELSE 1 END,
    CASE WHEN LOWER(COALESCE(profile.first_name, '')) LIKE LOWER(BTRIM(COALESCE(_q, ''))) || '%' THEN 0 ELSE 1 END,
    folder_count DESC,
    display_name ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 12), 1), 24);
$$;

CREATE OR REPLACE FUNCTION public.get_public_teacher_profile(_slug text)
RETURNS TABLE (
  display_name text,
  avatar_url text,
  public_slug text,
  public_bio text,
  public_specialties text[],
  folder_count bigint,
  list_count bigint,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    CASE
      WHEN LOWER(COALESCE(NULLIF(BTRIM(profile.first_name), ''), 'Professor')) LIKE 'professor %'
        THEN COALESCE(NULLIF(BTRIM(profile.first_name), ''), 'Professor')
      ELSE 'Professor ' || COALESCE(NULLIF(BTRIM(profile.first_name), ''), 'Professor')
    END,
    profile.avatar_url,
    profile.public_slug,
    NULLIF(BTRIM(profile.public_bio), ''),
    COALESCE(profile.public_specialties, ARRAY[]::text[]),
    (
      SELECT COUNT(*)
      FROM public.folders folder
      WHERE folder.owner_id = profile.id
        AND folder.visibility = 'class'
        AND folder.class_id IS NULL
        AND folder.deleted_at IS NULL
    ),
    (
      SELECT COUNT(*)
      FROM public.folders folder
      JOIN public.lists list_row ON list_row.folder_id = folder.id
      WHERE folder.owner_id = profile.id
        AND folder.visibility = 'class'
        AND folder.class_id IS NULL
        AND folder.deleted_at IS NULL
        AND list_row.owner_id = profile.id
        AND list_row.visibility = 'class'
        AND list_row.class_id IS NULL
        AND list_row.deleted_at IS NULL
    ),
    (
      SELECT COUNT(*)
      FROM public.folders folder
      JOIN public.lists list_row ON list_row.folder_id = folder.id
      JOIN public.flashcards card ON card.list_id = list_row.id
      WHERE folder.owner_id = profile.id
        AND folder.visibility = 'class'
        AND folder.class_id IS NULL
        AND folder.deleted_at IS NULL
        AND list_row.owner_id = profile.id
        AND list_row.visibility = 'class'
        AND list_row.class_id IS NULL
        AND list_row.deleted_at IS NULL
        AND card.user_id = profile.id
        AND card.deleted_at IS NULL
        AND card.parent_card_id IS NULL
    )
  FROM public.profiles profile
  WHERE COALESCE(profile.is_teacher, false) = true
    AND COALESCE(profile.public_access_enabled, false) = true
    AND profile.public_slug IS NOT NULL
    AND LOWER(BTRIM(profile.public_slug)) = LOWER(BTRIM(_slug))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_teacher_folders(_slug text)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  list_count bigint,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    folder.id,
    folder.title,
    folder.description,
    (
      SELECT COUNT(*)
      FROM public.lists list_row
      WHERE list_row.folder_id = folder.id
        AND list_row.owner_id = profile.id
        AND list_row.visibility = 'class'
        AND list_row.class_id IS NULL
        AND list_row.deleted_at IS NULL
    ),
    (
      SELECT COUNT(*)
      FROM public.lists list_row
      JOIN public.flashcards card ON card.list_id = list_row.id
      WHERE list_row.folder_id = folder.id
        AND list_row.owner_id = profile.id
        AND list_row.visibility = 'class'
        AND list_row.class_id IS NULL
        AND list_row.deleted_at IS NULL
        AND card.user_id = profile.id
        AND card.deleted_at IS NULL
        AND card.parent_card_id IS NULL
    )
  FROM public.profiles profile
  JOIN public.folders folder ON folder.owner_id = profile.id
  WHERE COALESCE(profile.is_teacher, false) = true
    AND COALESCE(profile.public_access_enabled, false) = true
    AND profile.public_slug IS NOT NULL
    AND LOWER(BTRIM(profile.public_slug)) = LOWER(BTRIM(_slug))
    AND folder.visibility = 'class'
    AND folder.class_id IS NULL
    AND folder.deleted_at IS NULL
  ORDER BY folder.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.search_public_teachers(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_teacher_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_teacher_folders(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_public_teachers(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_folders(text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
