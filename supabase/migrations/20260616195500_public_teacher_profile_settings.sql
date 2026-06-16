-- Stage 3: authenticated teacher settings for the public directory.
-- Keeps direct-link visibility separate from directory discoverability.

CREATE OR REPLACE FUNCTION public.get_own_public_teacher_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR COALESCE(v_profile.is_teacher, false) = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEACHER_REQUIRED');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'first_name', v_profile.first_name,
    'avatar_url', v_profile.avatar_url,
    'public_slug', v_profile.public_slug,
    'public_bio', v_profile.public_bio,
    'public_specialties', COALESCE(v_profile.public_specialties, ARRAY[]::text[]),
    'public_access_enabled', COALESCE(v_profile.public_access_enabled, false),
    'public_profile_searchable', COALESCE(v_profile.public_profile_searchable, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_public_teacher_settings(
  _public_bio text,
  _public_specialties text[],
  _public_access_enabled boolean,
  _public_profile_searchable boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_teacher boolean;
  v_slug text;
  v_bio text;
  v_specialties text[];
  v_specialty text;
  v_searchable boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT is_teacher, public_slug
    INTO v_is_teacher, v_slug
  FROM public.profiles
  WHERE id = auth.uid();

  IF COALESCE(v_is_teacher, false) = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEACHER_REQUIRED');
  END IF;

  v_bio := NULLIF(BTRIM(COALESCE(_public_bio, '')), '');
  IF LENGTH(COALESCE(v_bio, '')) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'BIO_TOO_LONG');
  END IF;

  SELECT COALESCE(ARRAY_AGG(value ORDER BY first_position), ARRAY[]::text[])
    INTO v_specialties
  FROM (
    SELECT MIN(position) AS first_position, BTRIM(raw_value) AS value
    FROM UNNEST(COALESCE(_public_specialties, ARRAY[]::text[])) WITH ORDINALITY AS item(raw_value, position)
    WHERE BTRIM(COALESCE(raw_value, '')) <> ''
    GROUP BY LOWER(BTRIM(raw_value)), BTRIM(raw_value)
  ) normalized;

  IF COALESCE(ARRAY_LENGTH(v_specialties, 1), 0) > 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOO_MANY_SPECIALTIES');
  END IF;

  FOREACH v_specialty IN ARRAY v_specialties LOOP
    IF LENGTH(v_specialty) > 40 THEN
      RETURN jsonb_build_object('success', false, 'error', 'SPECIALTY_TOO_LONG');
    END IF;
  END LOOP;

  IF COALESCE(_public_access_enabled, false) = true
     AND NULLIF(BTRIM(COALESCE(v_slug, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PUBLIC_SLUG_REQUIRED');
  END IF;

  v_searchable := COALESCE(_public_access_enabled, false)
                  AND COALESCE(_public_profile_searchable, false);

  UPDATE public.profiles
  SET public_bio = v_bio,
      public_specialties = v_specialties,
      public_access_enabled = COALESCE(_public_access_enabled, false),
      public_profile_searchable = v_searchable,
      updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'public_bio', v_bio,
    'public_specialties', v_specialties,
    'public_access_enabled', COALESCE(_public_access_enabled, false),
    'public_profile_searchable', v_searchable
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_own_public_teacher_folders()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  is_public boolean,
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
    f.visibility = 'class' AS is_public,
    (
      SELECT COUNT(*)
      FROM public.lists l
      WHERE l.folder_id = f.id
        AND l.owner_id = auth.uid()
        AND l.class_id IS NULL
        AND l.deleted_at IS NULL
    ) AS list_count,
    (
      SELECT COUNT(*)
      FROM public.lists l
      JOIN public.flashcards fc ON fc.list_id = l.id
      WHERE l.folder_id = f.id
        AND l.owner_id = auth.uid()
        AND l.class_id IS NULL
        AND l.deleted_at IS NULL
        AND fc.user_id = auth.uid()
        AND fc.deleted_at IS NULL
    ) AS card_count
  FROM public.folders f
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE f.owner_id = auth.uid()
    AND COALESCE(p.is_teacher, false) = true
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
  ORDER BY f.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.set_public_teacher_folder_visibility(
  _folder_id uuid,
  _is_public boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_visibility text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT f.owner_id INTO v_owner
  FROM public.folders f
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE f.id = _folder_id
    AND f.owner_id = auth.uid()
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.is_teacher, false) = true;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FOLDER_NOT_FOUND');
  END IF;

  v_visibility := CASE WHEN COALESCE(_is_public, false) THEN 'class' ELSE 'private' END;

  UPDATE public.folders
  SET visibility = v_visibility,
      updated_at = now()
  WHERE id = _folder_id
    AND owner_id = auth.uid();

  UPDATE public.lists
  SET visibility = v_visibility,
      updated_at = now()
  WHERE folder_id = _folder_id
    AND owner_id = auth.uid()
    AND class_id IS NULL
    AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true, 'is_public', COALESCE(_is_public, false));
END;
$$;

-- Direct links remain available when the profile is public even if it is hidden
-- from directory search. Searchability is checked only by search_public_teachers.
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
    END,
    p.avatar_url,
    p.public_slug,
    NULLIF(BTRIM(p.public_bio), ''),
    COALESCE(p.public_specialties, ARRAY[]::text[]),
    (SELECT COUNT(*) FROM public.folders f WHERE f.owner_id = p.id AND f.visibility = 'class' AND f.class_id IS NULL AND f.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.folders f JOIN public.lists l ON l.folder_id = f.id WHERE f.owner_id = p.id AND f.visibility = 'class' AND f.class_id IS NULL AND f.deleted_at IS NULL AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.folders f JOIN public.lists l ON l.folder_id = f.id JOIN public.flashcards fc ON fc.list_id = l.id WHERE f.owner_id = p.id AND f.visibility = 'class' AND f.class_id IS NULL AND f.deleted_at IS NULL AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL AND fc.user_id = p.id AND fc.deleted_at IS NULL)
  FROM public.profiles p
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_slug IS NOT NULL
    AND LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(_slug))
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
    (SELECT COUNT(*) FROM public.lists l WHERE l.folder_id = f.id AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.lists l JOIN public.flashcards fc ON fc.list_id = l.id WHERE l.folder_id = f.id AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL AND fc.user_id = p.id AND fc.deleted_at IS NULL)
  FROM public.profiles p
  JOIN public.folders f ON f.owner_id = p.id
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_slug IS NOT NULL
    AND LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(_slug))
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
  ORDER BY f.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_own_public_teacher_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_public_teacher_settings(text, text[], boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_own_public_teacher_folders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_public_teacher_folder_visibility(uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_own_public_teacher_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_public_teacher_settings(text, text[], boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_public_teacher_folders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_public_teacher_folder_visibility(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_teacher_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_teacher_folders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_folders(text) TO anon, authenticated;
