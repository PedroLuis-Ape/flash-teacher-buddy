-- Canonical public learning-resource discovery for SEO/GEO.
-- Every function below exposes only folders and lists intentionally published
-- outside classroom context by a searchable public teacher profile.

CREATE INDEX IF NOT EXISTS idx_public_learning_folders
  ON public.folders (owner_id, updated_at DESC)
  WHERE visibility = 'class'
    AND class_id IS NULL
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_public_learning_lists
  ON public.lists (folder_id, order_index, updated_at DESC)
  WHERE visibility = 'class'
    AND class_id IS NULL
    AND deleted_at IS NULL;

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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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

-- Keep legacy portal APIs compatible while closing the historical gap where a
-- private list inside a public folder could be returned anonymously.
CREATE OR REPLACE FUNCTION public.get_portal_folder(_id uuid)
RETURNS public.folders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.*
  FROM public.folders f
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE f.id = _id
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.public_access_enabled, false) = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_lists_with_counts(_folder_id uuid)
RETURNS TABLE(
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
SET search_path = public
AS $$
  SELECT
    l.id, l.folder_id, l.owner_id, l.title, l.description,
    l.order_index, l.visibility, l.lang, l.class_id, l.institution_id,
    l.created_at, l.updated_at,
    COUNT(fc.id)::bigint AS card_count
  FROM public.lists l
  JOIN public.folders f ON f.id = l.folder_id
  JOIN public.profiles p ON p.id = f.owner_id
  LEFT JOIN public.flashcards fc
    ON fc.list_id = l.id
   AND fc.user_id = f.owner_id
   AND fc.deleted_at IS NULL
  WHERE l.folder_id = _folder_id
    AND l.owner_id = f.owner_id
    AND l.visibility = 'class'
    AND l.class_id IS NULL
    AND l.deleted_at IS NULL
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.public_access_enabled, false) = true
  GROUP BY l.id
  ORDER BY l.order_index ASC, l.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_lists(_folder_id uuid)
RETURNS SETOF public.lists
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.lists l
  JOIN public.folders f ON f.id = l.folder_id
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE l.folder_id = _folder_id
    AND l.owner_id = f.owner_id
    AND l.visibility = 'class'
    AND l.class_id IS NULL
    AND l.deleted_at IS NULL
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.public_access_enabled, false) = true
  ORDER BY l.order_index ASC, l.created_at ASC;
$$;

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
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE fc.list_id = _list_id
    AND fc.user_id = f.owner_id
    AND fc.deleted_at IS NULL
    AND l.owner_id = f.owner_id
    AND l.visibility = 'class'
    AND l.class_id IS NULL
    AND l.deleted_at IS NULL
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.public_access_enabled, false) = true
  ORDER BY fc.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_counts(_folder_id uuid)
RETURNS TABLE(list_count integer, card_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT l.id)::integer AS list_count,
    COUNT(DISTINCT fc.id)::integer AS card_count
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
  WHERE f.id = _folder_id
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.public_access_enabled, false) = true;
$$;

REVOKE ALL ON FUNCTION public.list_public_learning_resource_entries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_learning_resource(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_learning_resource_lists(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_portal_folder(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_portal_lists_with_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_portal_lists(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_portal_flashcards(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_portal_counts(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_public_learning_resource_entries(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_learning_resource(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_learning_resource_lists(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_folder(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_lists_with_counts(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_lists(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_flashcards(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_counts(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.list_public_learning_resource_entries(integer) IS
  'Build-time discovery feed for intentionally public teacher-owned folders.';
COMMENT ON FUNCTION public.get_public_learning_resource(uuid) IS
  'Canonical public folder metadata with author identity and aggregate counts.';
COMMENT ON FUNCTION public.get_public_learning_resource_lists(uuid) IS
  'Public lists inside one canonical public learning resource.';
