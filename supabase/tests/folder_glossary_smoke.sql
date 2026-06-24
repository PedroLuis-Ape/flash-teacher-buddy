-- Folder glossary contract: personal isolation, classroom read-only access,
-- and Super Importer routing to the resolved destination folder.

INSERT INTO auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'folder-teacher@app-piteco.local', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Folder Teacher","requested_account_type":"teacher","requested_public_slug":"folder_teacher"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'folder-student@app-piteco.local', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Folder Student","requested_account_type":"student"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'folder-outsider@app-piteco.local', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Folder Outsider","requested_account_type":"student"}'::jsonb,
    now(), now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.turmas(id, owner_teacher_id, nome, ativo, public)
VALUES (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Folder glossary classroom',
  true,
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.turma_membros(turma_id, user_id, role, ativo)
VALUES (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'aluno',
  true
)
ON CONFLICT (turma_id, user_id) DO UPDATE SET ativo = true;

INSERT INTO public.folders(id, owner_id, title, visibility, class_id)
VALUES
  (
    'a3000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Private folder glossary smoke',
    'private',
    NULL
  ),
  (
    'a3000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'Class folder glossary smoke',
    'class',
    'a2000000-0000-4000-8000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lists(id, folder_id, owner_id, title, visibility, class_id)
VALUES
  (
    'a4000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Private list glossary smoke',
    'private',
    NULL
  ),
  (
    'a4000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'Class list glossary smoke',
    'class',
    'a2000000-0000-4000-8000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

DO $$
DECLARE
  v_report jsonb;
BEGIN
  v_report := public.import_folder_glossary_v1(
    'a3000000-0000-4000-8000-000000000001',
    '[
      {
        "term":"could",
        "translation":"poderia",
        "alternatives":["conseguia","podia","poderia"],
        "note":"modal em contexto",
        "side":"A"
      }
    ]'::jsonb,
    'merge',
    false
  );

  IF (v_report->>'inserted')::integer <> 1 THEN
    RAISE EXCEPTION 'Personal folder import report is invalid: %', v_report;
  END IF;

  v_report := public.import_folder_glossary_v1(
    'a3000000-0000-4000-8000-000000000002',
    '[{"term":"classroom","translation":"turma","side":"A"}]'::jsonb,
    'merge',
    false
  );

  IF (v_report->>'inserted')::integer <> 1 THEN
    RAISE EXCEPTION 'Class folder import report is invalid: %', v_report;
  END IF;

  IF NOT public.can_manage_folder_glossary_v1(
    'a3000000-0000-4000-8000-000000000002',
    auth.uid()
  ) THEN
    RAISE EXCEPTION 'Teacher cannot manage the classroom folder glossary.';
  END IF;
END;
$$;

INSERT INTO public.global_import_batches(
  id, user_id, request_id, payload_hash, package_name,
  schema_version, status, options, summary, completed_at
) VALUES (
  'a5000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a6000000-0000-4000-8000-000000000001',
  'folder-glossary-smoke',
  'Folder glossary smoke package',
  1,
  'completed',
  '{}'::jsonb,
  '{}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.global_import_items(
  batch_id, user_id, entity_type, entity_id, action, item_path
) VALUES (
  'a5000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'folder',
  'a3000000-0000-4000-8000-000000000002',
  'created',
  'package.folders[0]'
);

DO $$
DECLARE
  v_report jsonb;
BEGIN
  v_report := public.sync_folder_glossaries_from_super_import_v1(
    'a5000000-0000-4000-8000-000000000001',
    '{
      "package":{
        "folders":[{
          "name":"Class folder glossary smoke",
          "lists":[{
            "name":"Class list glossary smoke",
            "glossary":[
              {"term":"must","translation":"deve","alternatives":["tem que"],"side":"A"}
            ]
          }]
        }]
      }
    }'::jsonb
  );

  IF (v_report->>'glossary_created')::integer <> 1
     OR v_report->>'glossary_scope' <> 'folder' THEN
    RAISE EXCEPTION 'Super Importer folder glossary report is invalid: %', v_report;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.folder_glossary
    WHERE folder_id = 'a3000000-0000-4000-8000-000000000002'
      AND original_text = 'must'
      AND primary_translation = 'deve'
      AND alternative_translations @> ARRAY['tem que']::text[]
  ) THEN
    RAISE EXCEPTION 'Super Importer did not save the glossary in the destination folder.';
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.account_glossary
    WHERE owner_id = 'a1000000-0000-4000-8000-000000000001'
      AND original_text = 'must'
  ) OR EXISTS (
    SELECT 1
    FROM public.list_glossary
    WHERE original_text = 'must'
  ) THEN
    RAISE EXCEPTION 'Super Importer leaked the folder glossary into a legacy table.';
  END IF;
END;
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

DO $$
DECLARE
  v_visible integer;
  v_denied boolean := false;
BEGIN
  IF NOT public.can_read_folder_glossary_v1(
    'a3000000-0000-4000-8000-000000000002',
    auth.uid()
  ) OR public.can_manage_folder_glossary_v1(
    'a3000000-0000-4000-8000-000000000002',
    auth.uid()
  ) THEN
    RAISE EXCEPTION 'Student classroom permissions are invalid.';
  END IF;

  SELECT count(*) INTO v_visible
  FROM public.folder_glossary
  WHERE folder_id = 'a3000000-0000-4000-8000-000000000002';

  IF v_visible <> 2 THEN
    RAISE EXCEPTION 'Student cannot read all classroom glossary entries: %', v_visible;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.folder_glossary
    WHERE folder_id = 'a3000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Student can read the teacher private glossary.';
  END IF;

  BEGIN
    PERFORM public.import_folder_glossary_v1(
      'a3000000-0000-4000-8000-000000000002',
      '[{"term":"forbidden","translation":"proibido"}]'::jsonb,
      'merge',
      false
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'Student was able to edit the classroom glossary.';
  END IF;
END;
$$;

RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

DO $$
BEGIN
  IF public.can_read_folder_glossary_v1(
    'a3000000-0000-4000-8000-000000000001',
    auth.uid()
  ) OR public.can_read_folder_glossary_v1(
    'a3000000-0000-4000-8000-000000000002',
    auth.uid()
  ) THEN
    RAISE EXCEPTION 'Outsider can read a folder glossary.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.folder_glossary) THEN
    RAISE EXCEPTION 'RLS leaked glossary rows to the outsider.';
  END IF;
END;
$$;

RESET ROLE;
