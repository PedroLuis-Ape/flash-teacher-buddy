-- Public teacher settings for the single official project.
-- Does not depend on classroom tables.

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
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
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
  v_profile public.profiles%ROWTYPE;
  v_bio text;
  v_specialties text[];
  v_specialty text;
  v_searchable boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND OR COALESCE(v_profile.is_teacher, false) = false THEN
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

  IF COALESCE(_public_access_enabled, false)
     AND NULLIF(BTRIM(COALESCE(v_profile.public_slug, '')), '') IS NULL THEN
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
    (SELECT COUNT(*) FROM public.lists l
      WHERE l.folder_id = f.id AND l.owner_id = auth.uid()
        AND l.class_id IS NULL AND l.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.lists l
      JOIN public.flashcards fc ON fc.list_id = l.id
      WHERE l.folder_id = f.id AND l.owner_id = auth.uid()
        AND l.class_id IS NULL AND l.deleted_at IS NULL
        AND fc.user_id = auth.uid() AND fc.deleted_at IS NULL
        AND fc.parent_card_id IS NULL)
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.folders f
    JOIN public.profiles p ON p.id = f.owner_id
    WHERE f.id = _folder_id AND f.owner_id = auth.uid()
      AND f.class_id IS NULL AND f.deleted_at IS NULL
      AND COALESCE(p.is_teacher, false) = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FOLDER_NOT_FOUND');
  END IF;

  UPDATE public.folders
  SET visibility = CASE WHEN COALESCE(_is_public, false) THEN 'class' ELSE 'private' END,
      updated_at = now()
  WHERE id = _folder_id AND owner_id = auth.uid();

  UPDATE public.lists
  SET visibility = CASE WHEN COALESCE(_is_public, false) THEN 'class' ELSE 'private' END,
      updated_at = now()
  WHERE folder_id = _folder_id AND owner_id = auth.uid()
    AND class_id IS NULL AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true, 'is_public', COALESCE(_is_public, false));
END;
$$;

REVOKE ALL ON FUNCTION public.get_own_public_teacher_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_public_teacher_settings(text, text[], boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_own_public_teacher_folders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_public_teacher_folder_visibility(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_public_teacher_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_public_teacher_settings(text, text[], boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_public_teacher_folders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_public_teacher_folder_visibility(uuid, boolean) TO authenticated;
