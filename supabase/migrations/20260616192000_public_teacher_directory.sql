-- Public teacher directory.
-- Exposes only fields intentionally meant for anonymous discovery.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_bio text,
  ADD COLUMN IF NOT EXISTS public_specialties text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS public_profile_searchable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.public_bio IS
  'Optional biography shown on the anonymous public teacher profile.';
COMMENT ON COLUMN public.profiles.public_specialties IS
  'Optional teaching specialties shown and searched in the public directory.';
COMMENT ON COLUMN public.profiles.public_profile_searchable IS
  'When true, an already public teacher profile may appear in anonymous search results.';

-- Existing teachers who already enabled public access are kept discoverable so the
-- previous public portal does not silently lose its available publishers.
UPDATE public.profiles
SET public_profile_searchable = true
WHERE COALESCE(is_teacher, false) = true
  AND COALESCE(public_access_enabled, false) = true
  AND public_slug IS NOT NULL
  AND BTRIM(public_slug) <> '';

CREATE INDEX IF NOT EXISTS idx_profiles_public_teacher_directory
  ON public.profiles (LOWER(public_slug))
  WHERE COALESCE(is_teacher, false) = true
    AND COALESCE(public_access_enabled, false) = true
    AND public_profile_searchable = true;

CREATE INDEX IF NOT EXISTS idx_profiles_public_specialties
  ON public.profiles USING GIN (public_specialties);

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
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN LOWER(COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')) LIKE 'professor %'
        THEN COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
      ELSE 'Professor ' || COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
    END AS display_name,
    p.avatar_url,
    p.public_slug,
    NULLIF(BTRIM(p.public_bio), '') AS public_bio,
    COALESCE(p.public_specialties, ARRAY[]::text[]) AS public_specialties,
    (
      SELECT COUNT(*)
      FROM public.folders f
      WHERE f.owner_id = p.id
        AND f.visibility = 'class'
        AND f.class_id IS NULL
        AND f.deleted_at IS NULL
    ) AS folder_count,
    (
      SELECT COUNT(*)
      FROM public.folders f
      JOIN public.lists l ON l.folder_id = f.id
      WHERE f.owner_id = p.id
        AND f.visibility = 'class'
        AND f.class_id IS NULL
        AND f.deleted_at IS NULL
        AND l.owner_id = p.id
        AND l.visibility = 'class'
        AND l.class_id IS NULL
        AND l.deleted_at IS NULL
    ) AS list_count,
    (
      SELECT COUNT(*)
      FROM public.folders f
      JOIN public.lists l ON l.folder_id = f.id
      JOIN public.flashcards fc ON fc.list_id = l.id
      WHERE f.owner_id = p.id
        AND f.visibility = 'class'
        AND f.class_id IS NULL
        AND f.deleted_at IS NULL
        AND l.owner_id = p.id
        AND l.visibility = 'class'
        AND l.class_id IS NULL
        AND l.deleted_at IS NULL
        AND fc.user_id = p.id
        AND fc.deleted_at IS NULL
    ) AS card_count
  FROM public.profiles p
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_profile_searchable = true
    AND p.public_slug IS NOT NULL
    AND BTRIM(p.public_slug) <> ''
    AND (
      BTRIM(COALESCE(_q, '')) = ''
      OR p.first_name ILIKE '%' || BTRIM(_q) || '%'
      OR p.public_slug ILIKE '%' || BTRIM(_q) || '%'
      OR COALESCE(p.public_bio, '') ILIKE '%' || BTRIM(_q) || '%'
      OR EXISTS (
        SELECT 1
        FROM UNNEST(COALESCE(p.public_specialties, ARRAY[]::text[])) AS specialty
        WHERE specialty ILIKE '%' || BTRIM(_q) || '%'
      )
    )
  ORDER BY
    CASE WHEN LOWER(COALESCE(p.first_name, '')) = LOWER(BTRIM(COALESCE(_q, ''))) THEN 0 ELSE 1 END,
    CASE WHEN LOWER(COALESCE(p.first_name, '')) LIKE LOWER(BTRIM(COALESCE(_q, ''))) || '%' THEN 0 ELSE 1 END,
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
SET search_path = public
AS $$
  SELECT *
  FROM public.search_public_teachers('', 24) directory
  WHERE LOWER(directory.public_slug) = LOWER(BTRIM(_slug))
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
SET search_path = public
AS $$
  SELECT
    f.id,
    f.title,
    f.description,
    (
      SELECT COUNT(*)
      FROM public.lists l
      WHERE l.folder_id = f.id
        AND l.owner_id = p.id
        AND l.visibility = 'class'
        AND l.class_id IS NULL
        AND l.deleted_at IS NULL
    ) AS list_count,
    (
      SELECT COUNT(*)
      FROM public.lists l
      JOIN public.flashcards fc ON fc.list_id = l.id
      WHERE l.folder_id = f.id
        AND l.owner_id = p.id
        AND l.visibility = 'class'
        AND l.class_id IS NULL
        AND l.deleted_at IS NULL
        AND fc.user_id = p.id
        AND fc.deleted_at IS NULL
    ) AS card_count
  FROM public.profiles p
  JOIN public.folders f ON f.owner_id = p.id
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_profile_searchable = true
    AND LOWER(p.public_slug) = LOWER(BTRIM(_slug))
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
  ORDER BY f.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.search_public_teachers(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_teacher_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_teacher_folders(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_public_teachers(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_folders(text) TO anon, authenticated;
