-- Canonical public-resource counters count only principal cards.
-- Layer rows are internal parts of a principal card and must not inflate SEO,
-- portal or teacher-facing public totals.

CREATE OR REPLACE FUNCTION public.list_public_learning_resource_entries(
  _limit integer DEFAULT 2000
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  study_type text,
  lang_a text,
  lang_b text,
  labels_a text,
  labels_b text,
  tts_enabled boolean,
  created_at timestamptz,
  updated_at timestamptz,
  author_display_name text,
  author_slug text,
  author_avatar_url text,
  list_count bigint,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    f.id,
    f.title,
    NULLIF(BTRIM(f.description), '') AS description,
    f.study_type,
    f.lang_a,
    f.lang_b,
    f.labels_a,
    f.labels_b,
    f.tts_enabled,
    f.created_at,
    GREATEST(
      f.updated_at,
      COALESCE(MAX(l.updated_at), f.updated_at),
      COALESCE(MAX(fc.updated_at), f.updated_at)
    ) AS updated_at,
    CASE
      WHEN LOWER(COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')) LIKE 'professor %'
        THEN COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
      ELSE 'Professor ' || COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
    END AS author_display_name,
    p.public_slug AS author_slug,
    p.avatar_url AS author_avatar_url,
    COUNT(DISTINCT l.id)::bigint AS list_count,
    COUNT(DISTINCT fc.id)::bigint AS card_count
  FROM public.folders f
  JOIN public.profiles p ON p.id = f.owner_id
  LEFT JOIN public.lists l
    ON l.folder_id = f.id
   AND l.owner_id = f.owner_id
   AND l.visibility = 'class'
   AND l.class_id IS NULL
   AND l.deleted_at IS NULL
  LEFT JOIN public.flashcards fc
    ON fc.list_id = l.id
   AND fc.user_id = f.owner_id
   AND fc.deleted_at IS NULL
   AND fc.parent_card_id IS NULL
  WHERE f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_profile_searchable = true
    AND p.public_slug IS NOT NULL
    AND BTRIM(p.public_slug) <> ''
  GROUP BY f.id, p.id
  ORDER BY updated_at DESC, f.title ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 2000), 1), 10000);
$$;

CREATE OR REPLACE FUNCTION public.get_public_learning_resource(_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  owner_id uuid,
  study_type text,
  lang_a text,
  lang_b text,
  labels_a text,
  labels_b text,
  tts_enabled boolean,
  created_at timestamptz,
  updated_at timestamptz,
  author_display_name text,
  author_slug text,
  author_avatar_url text,
  list_count bigint,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    f.id,
    f.title,
    NULLIF(BTRIM(f.description), '') AS description,
    f.owner_id,
    f.study_type,
    f.lang_a,
    f.lang_b,
    f.labels_a,
    f.labels_b,
    f.tts_enabled,
    f.created_at,
    GREATEST(
      f.updated_at,
      COALESCE(MAX(l.updated_at), f.updated_at),
      COALESCE(MAX(fc.updated_at), f.updated_at)
    ) AS updated_at,
    CASE
      WHEN LOWER(COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')) LIKE 'professor %'
        THEN COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
      ELSE 'Professor ' || COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
    END AS author_display_name,
    p.public_slug AS author_slug,
    p.avatar_url AS author_avatar_url,
    COUNT(DISTINCT l.id)::bigint AS list_count,
    COUNT(DISTINCT fc.id)::bigint AS card_count
  FROM public.folders f
  JOIN public.profiles p ON p.id = f.owner_id
  LEFT JOIN public.lists l
    ON l.folder_id = f.id
   AND l.owner_id = f.owner_id
   AND l.visibility = 'class'
   AND l.class_id IS NULL
   AND l.deleted_at IS NULL
  LEFT JOIN public.flashcards fc
    ON fc.list_id = l.id
   AND fc.user_id = f.owner_id
   AND fc.deleted_at IS NULL
   AND fc.parent_card_id IS NULL
  WHERE f.id = _id
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_profile_searchable = true
    AND p.public_slug IS NOT NULL
    AND BTRIM(p.public_slug) <> ''
  GROUP BY f.id, p.id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_learning_resource_lists(_folder_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  order_index integer,
  study_type text,
  lang_a text,
  lang_b text,
  labels_a text,
  labels_b text,
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
    l.title,
    NULLIF(BTRIM(l.description), '') AS description,
    l.order_index,
    l.study_type,
    l.lang_a,
    l.lang_b,
    l.labels_a,
    l.labels_b,
    l.created_at,
    GREATEST(l.updated_at, COALESCE(MAX(fc.updated_at), l.updated_at)) AS updated_at,
    COUNT(fc.id)::bigint AS card_count
  FROM public.lists l
  JOIN public.folders f ON f.id = l.folder_id
  JOIN public.profiles p ON p.id = f.owner_id
  LEFT JOIN public.flashcards fc
    ON fc.list_id = l.id
   AND fc.user_id = f.owner_id
   AND fc.deleted_at IS NULL
   AND fc.parent_card_id IS NULL
  WHERE l.folder_id = _folder_id
    AND l.owner_id = f.owner_id
    AND l.visibility = 'class'
    AND l.class_id IS NULL
    AND l.deleted_at IS NULL
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_profile_searchable = true
    AND p.public_slug IS NOT NULL
    AND BTRIM(p.public_slug) <> ''
  GROUP BY l.id
  ORDER BY l.order_index ASC, l.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.list_public_learning_resource_entries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_learning_resource(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_learning_resource_lists(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_public_learning_resource_entries(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_learning_resource(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_learning_resource_lists(uuid) TO anon, authenticated;
