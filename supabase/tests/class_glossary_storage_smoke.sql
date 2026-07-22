-- Class glossary storage contract:
-- - one private system folder can back the class glossary without appearing as assignable content;
-- - teacher manages it;
-- - active class members read the glossary even though the folder row stays private;
-- - outsiders and students cannot modify it.

BEGIN;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'b1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'class-glossary-teacher@app-piteco.local', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Class Glossary Teacher","requested_account_type":"teacher","requested_public_slug":"class_glossary_teacher"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b1000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'class-glossary-student@app-piteco.local', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Class Glossary Student","requested_account_type":"student"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b1000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'class-glossary-outsider@app-piteco.local', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Class Glossary Outsider","requested_account_type":"student"}'::jsonb,
    now(), now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.turmas(id, owner_teacher_id, nome, ativo, public)
VALUES (
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'Class glossary storage smoke',
  true,
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.turma_membros(turma_id, user_id, role, ativo)
VALUES (
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  'aluno',
  true
)
ON CONFLICT (turma_id, user_id) DO UPDATE SET ativo = true;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

INSERT INTO public.folders(
  id, owner_id, title, description, visibility, class_id
) VALUES (
  '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80',
  'b1000000-0000-4000-8000-000000000001',
  'Glossário interno · Turma de teste',
  'ape-system:class-glossary:v1',
  'private',
  'b2000000-0000-4000-8000-000000000001'
);

DO $$
DECLARE
  v_report jsonb;
BEGIN
  v_report := public.import_folder_glossary_v1(
    '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80',
    '[{"term":"classroom","translation":"turma","side":"A"}]'::jsonb,
    'merge',
    false
  );

  IF (v_report->>'inserted')::integer <> 1 THEN
    RAISE EXCEPTION 'Teacher could not create the class glossary entry: %', v_report;
  END IF;

  IF NOT public.can_manage_folder_glossary_v1(
    '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80',
    auth.uid()
  ) THEN
    RAISE EXCEPTION 'Teacher cannot manage the private class glossary storage.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.folders
    WHERE id = '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80'
      AND visibility = 'class'
  ) THEN
    RAISE EXCEPTION 'System storage leaked into the assignable class-folder visibility.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.folders
    WHERE id = '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80'
      AND class_id IS NULL
  ) THEN
    RAISE EXCEPTION 'System storage leaked into the personal-folder scope.';
  END IF;
END;
$$;

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

DO $$
DECLARE
  v_visible_entries integer;
  v_visible_folders integer;
  v_denied boolean := false;
BEGIN
  SELECT count(*) INTO v_visible_folders
  FROM public.folders
  WHERE id = '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80';

  IF v_visible_folders <> 0 THEN
    RAISE EXCEPTION 'Student can list the private class glossary folder.';
  END IF;

  IF NOT public.can_read_folder_glossary_v1(
    '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80',
    auth.uid()
  ) OR public.can_manage_folder_glossary_v1(
    '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80',
    auth.uid()
  ) THEN
    RAISE EXCEPTION 'Student class glossary permissions are invalid.';
  END IF;

  SELECT count(*) INTO v_visible_entries
  FROM public.folder_glossary
  WHERE folder_id = '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80';

  IF v_visible_entries <> 1 THEN
    RAISE EXCEPTION 'Student cannot read the class glossary entry: %', v_visible_entries;
  END IF;

  BEGIN
    PERFORM public.import_folder_glossary_v1(
      '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80',
      '[{"term":"forbidden","translation":"proibido","side":"A"}]'::jsonb,
      'merge',
      false
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'Student was able to modify the class glossary.';
  END IF;
END;
$$;

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

DO $$
BEGIN
  IF public.can_read_folder_glossary_v1(
    '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80',
    auth.uid()
  ) THEN
    RAISE EXCEPTION 'Outsider can read the class glossary.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.folder_glossary
    WHERE folder_id = '1ec1f09e-7b2d-0a8c-1e3f-16b405d27c80'
  ) THEN
    RAISE EXCEPTION 'RLS leaked the class glossary to an outsider.';
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
