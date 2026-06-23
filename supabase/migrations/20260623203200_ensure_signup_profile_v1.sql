CREATE OR REPLACE FUNCTION public.ensure_signup_profile_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_teacher boolean;
  v_user_type text;
  v_role public.app_role;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  INSERT INTO public.profiles (
    id,
    role,
    is_teacher,
    user_type,
    public_access_enabled
  )
  VALUES (
    v_user_id,
    'student',
    false,
    'aluno'::public.user_type,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT COALESCE(is_teacher, false), user_type::text
  INTO v_is_teacher, v_user_type
  FROM public.profiles
  WHERE id = v_user_id;

  v_role := CASE
    WHEN v_is_teacher OR v_user_type = 'professor'
      THEN 'owner'::public.app_role
    ELSE 'student'::public.app_role
  END;

  DELETE FROM public.user_roles
  WHERE user_id = v_user_id
    AND role IN ('owner'::public.app_role, 'student'::public.app_role)
    AND role <> v_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'account_type', CASE WHEN v_role = 'owner'::public.app_role THEN 'teacher' ELSE 'student' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_signup_profile_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_signup_profile_v1() TO authenticated;
