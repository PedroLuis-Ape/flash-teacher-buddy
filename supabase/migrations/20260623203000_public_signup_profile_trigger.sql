CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type text;
  v_is_teacher boolean;
  v_role public.app_role;
  v_slug text;
BEGIN
  v_account_type := CASE lower(COALESCE(
    NEW.raw_user_meta_data ->> 'requested_account_type',
    'student'
  ))
    WHEN 'teacher' THEN 'teacher'
    WHEN 'professor' THEN 'teacher'
    ELSE 'student'
  END;

  v_is_teacher := v_account_type = 'teacher';
  v_role := CASE
    WHEN v_is_teacher THEN 'owner'::public.app_role
    ELSE 'student'::public.app_role
  END;
  v_slug := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data ->> 'requested_public_slug', ''),
    '[^a-z0-9_]',
    '',
    'g'
  ));

  IF length(v_slug) >= 3 THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_slug, 0));
  END IF;

  IF length(v_slug) < 3 OR EXISTS (
    SELECT 1 FROM public.profiles WHERE public_slug = v_slug
  ) THEN
    v_slug := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    first_name,
    avatar_url,
    role,
    is_teacher,
    user_type,
    public_slug,
    public_access_enabled
  )
  VALUES (
    NEW.id,
    NULLIF(trim(COALESCE(
      NEW.raw_user_meta_data ->> 'first_name',
      NEW.raw_user_meta_data ->> 'name',
      ''
    )), ''),
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    v_role::text,
    v_is_teacher,
    CASE WHEN v_is_teacher THEN 'professor' ELSE 'aluno' END::public.user_type,
    v_slug,
    v_is_teacher AND v_slug IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, v_role
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = NEW.id
      AND role = v_role
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
