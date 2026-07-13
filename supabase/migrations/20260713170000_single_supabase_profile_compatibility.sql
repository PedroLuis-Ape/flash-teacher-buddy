-- Compatibility layer for the single official Supabase project.
-- The project was rebuilt with the study/store core, while the frontend still
-- expects the profile fields used by authentication, public publishing and SEO.
-- This migration is additive and idempotent; it never replaces core tables.

DO $$
BEGIN
  CREATE TYPE public.user_type AS ENUM ('professor', 'aluno');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS ape_id text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS google_connect_prompt_dont_show boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_connect_prompt_version_seen integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS google_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_teacher boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_access_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_bio text,
  ADD COLUMN IF NOT EXISTS public_profile_searchable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS public_specialties text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS user_tag text,
  ADD COLUMN IF NOT EXISTS user_type public.user_type;

UPDATE public.profiles
SET first_name = NULLIF(BTRIM(display_name), '')
WHERE first_name IS NULL
  AND NULLIF(BTRIM(display_name), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_account_id_unique
  ON public.profiles(account_id)
  WHERE account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_ape_id_unique
  ON public.profiles(ape_id)
  WHERE ape_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_tag_unique
  ON public.profiles(user_tag)
  WHERE user_tag IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_public_slug_unique
  ON public.profiles(LOWER(public_slug))
  WHERE public_slug IS NOT NULL AND BTRIM(public_slug) <> '';

CREATE OR REPLACE FUNCTION public.generate_user_tag()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text;
BEGIN
  LOOP
    v_value := 'PTC-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 4));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_tag = v_value);
  END LOOP;
  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_ape_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text;
BEGIN
  LOOP
    v_value := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE ape_id = v_value);
  END LOOP;
  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_profile_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.account_id := COALESCE(NEW.account_id, gen_random_uuid());
  NEW.ape_id := COALESCE(NEW.ape_id, public.generate_ape_id());
  NEW.user_tag := COALESCE(NEW.user_tag, public.generate_user_tag());
  NEW.first_name := COALESCE(NEW.first_name, NULLIF(BTRIM(NEW.display_name), ''));
  NEW.display_name := COALESCE(NULLIF(BTRIM(NEW.display_name), ''), NEW.first_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_profile_identifiers_trigger ON public.profiles;
CREATE TRIGGER prepare_profile_identifiers_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prepare_profile_identifiers();

UPDATE public.profiles SET account_id = gen_random_uuid() WHERE account_id IS NULL;
UPDATE public.profiles SET ape_id = public.generate_ape_id() WHERE ape_id IS NULL;
UPDATE public.profiles SET user_tag = public.generate_user_tag() WHERE user_tag IS NULL;

-- Replace the reduced rebuild RPC with the single comprehensive profile RPC.
DROP FUNCTION IF EXISTS public.update_own_profile(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_own_profile(
  uuid, text, text, boolean, text, text, text, text, boolean, integer, text, text, boolean
);
DROP FUNCTION IF EXISTS public.update_own_profile(
  uuid, text, text, boolean, text, text, text, text, boolean, integer, text, text, boolean, text
);

CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_user_id uuid,
  p_first_name text DEFAULT NULL,
  p_public_slug text DEFAULT NULL,
  p_public_access_enabled boolean DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_avatar_skin_id text DEFAULT NULL,
  p_mascot_skin_id text DEFAULT NULL,
  p_google_connected_at text DEFAULT NULL,
  p_google_connect_prompt_dont_show boolean DEFAULT NULL,
  p_google_connect_prompt_version_seen integer DEFAULT NULL,
  p_last_active_at text DEFAULT NULL,
  p_user_type text DEFAULT NULL,
  p_is_teacher boolean DEFAULT NULL,
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current_teacher boolean;
  v_safe_teacher boolean;
  v_safe_type public.user_type;
  v_slug text;
BEGIN
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  INSERT INTO public.profiles(id, first_name, display_name)
  VALUES(v_uid, NULLIF(BTRIM(p_first_name), ''), NULLIF(BTRIM(COALESCE(p_display_name, p_first_name)), ''))
  ON CONFLICT(id) DO NOTHING;

  SELECT COALESCE(is_teacher, false) INTO v_current_teacher
  FROM public.profiles WHERE id = v_uid;

  -- A student cannot promote their own account through this generic RPC.
  v_safe_teacher := CASE
    WHEN v_current_teacher THEN COALESCE(p_is_teacher, true)
    ELSE false
  END;
  v_safe_type := CASE
    WHEN v_safe_teacher THEN 'professor'::public.user_type
    ELSE 'aluno'::public.user_type
  END;

  v_slug := CASE
    WHEN p_public_slug IS NULL THEN NULL
    ELSE NULLIF(LOWER(REGEXP_REPLACE(BTRIM(p_public_slug), '[^a-z0-9_]', '', 'g')), '')
  END;

  IF v_slug IS NOT NULL AND LENGTH(v_slug) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PUBLIC_SLUG_TOO_SHORT');
  END IF;
  IF v_slug IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(public_slug) = v_slug AND id <> v_uid
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PUBLIC_SLUG_TAKEN');
  END IF;

  UPDATE public.profiles
  SET first_name = COALESCE(NULLIF(BTRIM(p_first_name), ''), first_name),
      display_name = COALESCE(NULLIF(BTRIM(p_display_name), ''), NULLIF(BTRIM(p_first_name), ''), display_name),
      public_slug = CASE WHEN p_public_slug IS NULL THEN public_slug ELSE v_slug END,
      public_access_enabled = CASE
        WHEN p_public_access_enabled IS NULL THEN public_access_enabled
        WHEN p_public_access_enabled AND COALESCE(v_slug, public_slug) IS NULL THEN false
        ELSE p_public_access_enabled
      END,
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      avatar_skin_id = COALESCE(p_avatar_skin_id, avatar_skin_id),
      mascot_skin_id = COALESCE(p_mascot_skin_id, mascot_skin_id),
      google_connected_at = CASE
        WHEN p_google_connected_at = '__NULL__' THEN NULL
        WHEN p_google_connected_at IS NOT NULL THEN p_google_connected_at::timestamptz
        ELSE google_connected_at
      END,
      google_connect_prompt_dont_show = COALESCE(p_google_connect_prompt_dont_show, google_connect_prompt_dont_show),
      google_connect_prompt_version_seen = COALESCE(p_google_connect_prompt_version_seen, google_connect_prompt_version_seen),
      last_active_at = CASE WHEN p_last_active_at IS NOT NULL THEN p_last_active_at::timestamptz ELSE last_active_at END,
      is_teacher = v_safe_teacher,
      user_type = v_safe_type,
      role = CASE WHEN v_safe_teacher THEN 'owner' ELSE COALESCE(role, 'student') END,
      updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_profile(
  uuid, text, text, boolean, text, text, text, text, boolean, integer, text, text, boolean, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_profile(
  uuid, text, text, boolean, text, text, text, text, boolean, integer, text, text, boolean, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_public_slug_available_v1(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LENGTH(LOWER(REGEXP_REPLACE(COALESCE(p_slug, ''), '[^a-z0-9_]', '', 'g'))) >= 3
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE LOWER(public_slug) = LOWER(REGEXP_REPLACE(COALESCE(p_slug, ''), '[^a-z0-9_]', '', 'g'))
    );
$$;
REVOKE ALL ON FUNCTION public.is_public_slug_available_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_slug_available_v1(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type text;
  v_teacher boolean;
  v_slug text;
  v_name text;
BEGIN
  v_account_type := LOWER(COALESCE(NEW.raw_user_meta_data ->> 'requested_account_type', 'student'));
  v_teacher := v_account_type IN ('teacher', 'professor');
  v_slug := NULLIF(LOWER(REGEXP_REPLACE(
    COALESCE(NEW.raw_user_meta_data ->> 'requested_public_slug', ''),
    '[^a-z0-9_]', '', 'g'
  )), '');
  IF v_slug IS NOT NULL AND (LENGTH(v_slug) < 3 OR EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(public_slug) = v_slug
  )) THEN
    v_slug := NULL;
  END IF;
  v_name := NULLIF(BTRIM(COALESCE(
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name',
    ''
  )), '');

  INSERT INTO public.profiles(
    id, first_name, display_name, avatar_url, is_teacher, user_type,
    role, public_slug, public_access_enabled, public_profile_searchable
  ) VALUES (
    NEW.id, v_name, v_name, NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    v_teacher, CASE WHEN v_teacher THEN 'professor' ELSE 'aluno' END::public.user_type,
    CASE WHEN v_teacher THEN 'owner' ELSE 'student' END,
    v_slug, v_teacher AND v_slug IS NOT NULL, false
  )
  ON CONFLICT(id) DO UPDATE
  SET first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TABLE public.profiles IS
  'Single-project profile schema used by authentication, store, public publishing and study features.';
