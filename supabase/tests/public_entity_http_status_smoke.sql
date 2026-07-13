\set ON_ERROR_STOP on

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '30303030-3030-4030-8030-303030303030',
  'authenticated',
  'authenticated',
  'public-status-smoke@app-piteco.local',
  crypt('smoke-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  id,
  first_name,
  is_teacher,
  public_access_enabled,
  public_profile_searchable,
  public_slug
) VALUES (
  '30303030-3030-4030-8030-303030303030',
  'Status Teacher',
  true,
  false,
  false,
  'status-teacher'
) ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  is_teacher = true,
  public_access_enabled = false,
  public_profile_searchable = false,
  public_slug = EXCLUDED.public_slug;

INSERT INTO public.folders (
  id,
  owner_id,
  title,
  visibility,
  class_id
) VALUES (
  '31313131-3131-4131-8131-313131313131',
  '30303030-3030-4030-8030-303030303030',
  'Lifecycle folder',
  'private',
  NULL
) ON CONFLICT (id) DO NOTHING;

SET ROLE anon;
DO $$
BEGIN
  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('teacher', 'status-teacher')
  ) <> 404 THEN
    RAISE EXCEPTION 'A never-published teacher must return 404';
  END IF;

  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('learning_resource', '31313131-3131-4131-8131-313131313131')
  ) <> 404 THEN
    RAISE EXCEPTION 'A never-published folder must return 404';
  END IF;

  IF has_table_privilege('anon', 'public.public_entity_publications', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous users can read the publication registry directly';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.profiles
SET public_access_enabled = true,
    public_profile_searchable = true
WHERE id = '30303030-3030-4030-8030-303030303030';

SET ROLE anon;
DO $$
BEGIN
  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('teacher', 'STATUS-TEACHER')
  ) <> 200 THEN
    RAISE EXCEPTION 'Published teacher must return 200 with case-normalized lookup';
  END IF;

  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('learning_resource', '31313131-3131-4131-8131-313131313131')
  ) <> 404 THEN
    RAISE EXCEPTION 'Private folder must remain 404 after profile publication';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.folders
SET visibility = 'class'
WHERE id = '31313131-3131-4131-8131-313131313131';

SET ROLE anon;
DO $$
DECLARE
  status_row record;
BEGIN
  SELECT * INTO status_row
  FROM public.get_public_entity_http_status('learning_resource', '31313131-3131-4131-8131-313131313131');

  IF status_row.status_code <> 200 OR status_row.state <> 'public' THEN
    RAISE EXCEPTION 'Published folder must return 200/public';
  END IF;

  IF status_row.canonical_path <> '/portal/folder/31313131-3131-4131-8131-313131313131' THEN
    RAISE EXCEPTION 'Published folder canonical path is invalid: %', status_row.canonical_path;
  END IF;

  IF status_row.first_published_at IS NULL OR status_row.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'Published folder lifecycle timestamps are invalid';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.folders
SET visibility = 'private'
WHERE id = '31313131-3131-4131-8131-313131313131';

SET ROLE anon;
DO $$
BEGIN
  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('learning_resource', '31313131-3131-4131-8131-313131313131')
  ) <> 410 THEN
    RAISE EXCEPTION 'Withdrawn folder must return 410';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.folders
SET visibility = 'class'
WHERE id = '31313131-3131-4131-8131-313131313131';

SET ROLE anon;
DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.get_public_entity_http_status('learning_resource', '31313131-3131-4131-8131-313131313131')
    WHERE status_code = 200
      AND withdrawn_at IS NULL
  ) <> 1 THEN
    RAISE EXCEPTION 'Republished folder must return 200 and clear withdrawn_at';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.profiles
SET public_slug = 'status-teacher-v2'
WHERE id = '30303030-3030-4030-8030-303030303030';

SET ROLE anon;
DO $$
BEGIN
  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('teacher', 'status-teacher')
  ) <> 410 THEN
    RAISE EXCEPTION 'Previous public slug must return 410 after a slug change';
  END IF;

  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('teacher', 'status-teacher-v2')
  ) <> 200 THEN
    RAISE EXCEPTION 'New public slug must return 200';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.profiles
SET public_access_enabled = false,
    public_profile_searchable = false
WHERE id = '30303030-3030-4030-8030-303030303030';

INSERT INTO public.folders (
  id,
  owner_id,
  title,
  visibility,
  class_id
) VALUES (
  '32323232-3232-4232-8232-323232323232',
  '30303030-3030-4030-8030-303030303030',
  'Never published private folder',
  'private',
  NULL
) ON CONFLICT (id) DO NOTHING;

SET ROLE anon;
DO $$
BEGIN
  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('teacher', 'status-teacher-v2')
  ) <> 410 THEN
    RAISE EXCEPTION 'Disabled public profile must return 410';
  END IF;

  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('learning_resource', '31313131-3131-4131-8131-313131313131')
  ) <> 410 THEN
    RAISE EXCEPTION 'Published folder must return 410 while its profile is disabled';
  END IF;

  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('learning_resource', '32323232-3232-4232-8232-323232323232')
  ) <> 404 THEN
    RAISE EXCEPTION 'Never-published private folder must remain 404';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.profiles
SET public_access_enabled = true,
    public_profile_searchable = true
WHERE id = '30303030-3030-4030-8030-303030303030';

SET ROLE anon;
DO $$
BEGIN
  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('teacher', 'status-teacher-v2')
  ) <> 200 THEN
    RAISE EXCEPTION 'Republished profile must return 200';
  END IF;

  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('learning_resource', '31313131-3131-4131-8131-313131313131')
  ) <> 200 THEN
    RAISE EXCEPTION 'Public folder must be restored when its profile is republished';
  END IF;

  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('learning_resource', '32323232-3232-4232-8232-323232323232')
  ) <> 404 THEN
    RAISE EXCEPTION 'Private folder must not acquire a publication history during profile republish';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.folders
SET deleted_at = now()
WHERE id = '31313131-3131-4131-8131-313131313131';

SET ROLE anon;
DO $$
BEGIN
  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('learning_resource', '31313131-3131-4131-8131-313131313131')
  ) <> 410 THEN
    RAISE EXCEPTION 'Soft-deleted published folder must return 410';
  END IF;

  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('teacher', 'never-published-slug')
  ) <> 404 THEN
    RAISE EXCEPTION 'Unknown teacher slug must return 404';
  END IF;

  IF (
    SELECT status_code
    FROM public.get_public_entity_http_status('learning_resource', '33333333-3333-4333-8333-333333333333')
  ) <> 404 THEN
    RAISE EXCEPTION 'Unknown folder id must return 404';
  END IF;
END;
$$;
RESET ROLE;

SELECT 'public entity HTTP lifecycle smoke passed' AS result;
