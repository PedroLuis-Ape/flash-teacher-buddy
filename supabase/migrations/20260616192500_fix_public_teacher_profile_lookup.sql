-- Ensure direct public teacher profile lookup never depends on directory limits.
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
    AND LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(_slug))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_teacher_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_profile(text) TO anon, authenticated;
