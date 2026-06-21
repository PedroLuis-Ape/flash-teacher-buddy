DO $$
DECLARE
  v_teacher_id uuid := '11111111-1111-4111-8111-111111111111';
  v_turma_id uuid := '44444444-4444-4444-8444-444444444444';
  v_report jsonb;
  v_batch_id uuid;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_teacher_id,
    'authenticated',
    'authenticated',
    'classroom-import@app-piteco.local',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', v_teacher_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.profiles(id, first_name, is_teacher)
  VALUES (v_teacher_id, 'Importer Smoke', true)
  ON CONFLICT (id) DO UPDATE SET is_teacher = true;

  INSERT INTO public.turmas(id, owner_teacher_id, nome, ativo, public)
  VALUES (v_turma_id, v_teacher_id, 'Classroom importer smoke', true, true)
  ON CONFLICT (id) DO NOTHING;

  SELECT public.import_app_piteco_super_package_to_class_v1(
    '55555555-5555-4555-8555-555555555555',
    '{
      "schema":"app-piteco-super-import",
      "version":"2.0",
      "package":{
        "name":"Classroom Smoke Package",
        "folders":[{
          "name":"Classroom Smoke Folder",
          "lists":[{
            "name":"Classroom Smoke List",
            "front_language":"en",
            "back_language":"pt-BR",
            "study_type":"language",
            "tts_enabled":true,
            "glossary":[{
              "term":"classroom",
              "translation":"turma",
              "side":"A",
              "note":"smoke glossary"
            }],
            "cards":[{
              "type":"normal",
              "front":"Welcome to class",
              "back":"Bem-vindo à turma",
              "detailed_explanation":"Classroom-only smoke card"
            }]
          }]
        }]
      }
    }'::jsonb,
    '{
      "folders":{
        "0":{
          "folder":{"mode":"create","name":"Classroom Smoke Folder"},
          "lists":{"0":{"mode":"create","name":"Classroom Smoke List"}}
        }
      }
    }'::jsonb,
    v_turma_id,
    'skip'
  ) INTO v_report;

  IF COALESCE((v_report->>'assignments_created')::integer, 0) <> 1
     OR COALESCE((v_report->>'folders_created')::integer, 0) <> 1
     OR COALESCE((v_report->>'lists_created')::integer, 0) <> 1
     OR COALESCE((v_report->>'cards_created')::integer, 0) <> 1
     OR COALESCE((v_report->>'glossary_created')::integer, 0) <> 1
     OR v_report->>'target_scope' <> 'classroom'
     OR (v_report->>'turma_id')::uuid <> v_turma_id THEN
    RAISE EXCEPTION 'Unexpected classroom importer report: %', v_report;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.atribuicoes a
    JOIN public.folders f ON f.id = a.fonte_id
    JOIN public.lists l ON l.folder_id = f.id
    JOIN public.flashcards c ON c.list_id = l.id
    WHERE a.turma_id = v_turma_id
      AND a.fonte_tipo::text = 'pasta'
      AND f.owner_id = v_teacher_id
      AND f.class_id = v_turma_id
      AND f.visibility = 'class'
      AND l.owner_id = v_teacher_id
      AND l.class_id = v_turma_id
      AND l.visibility = 'class'
      AND c.term = 'Welcome to class'
      AND c.translation = 'Bem-vindo à turma'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.account_glossary g
    WHERE g.owner_id = v_teacher_id
      AND g.original_text = 'classroom'
      AND g.translated_text = 'turma'
  ) THEN
    RAISE EXCEPTION 'Classroom importer did not persist hierarchy and central glossary.';
  END IF;

  v_batch_id := (v_report->>'batch_id')::uuid;
  PERFORM public.undo_classroom_global_import_v1(v_batch_id);

  IF EXISTS (
    SELECT 1 FROM public.folders f
    WHERE f.owner_id = v_teacher_id
      AND f.class_id = v_turma_id
      AND f.title = 'Classroom Smoke Folder'
  ) OR EXISTS (
    SELECT 1 FROM public.atribuicoes a
    WHERE a.turma_id = v_turma_id
      AND a.titulo = 'Classroom Smoke Folder'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.global_import_batches b
    WHERE b.id = v_batch_id
      AND b.status = 'undone'
  ) THEN
    RAISE EXCEPTION 'Classroom import undo left residual hierarchy data.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.account_glossary g
    WHERE g.owner_id = v_teacher_id
      AND g.original_text = 'classroom'
      AND g.translated_text = 'turma'
  ) THEN
    RAISE EXCEPTION 'Undo removed a reusable account glossary entry.';
  END IF;
END;
$$;
