DO $$
DECLARE
  smoke_user uuid := '91111111-1111-4111-8111-111111111111';
  v_folder_id uuid;
  v_list_id uuid;
  v_existing_card_id uuid;
  v_report jsonb;
  v_batch_id uuid;
  v_payload jsonb;
  v_destination_plan jsonb;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    smoke_user,
    'authenticated',
    'authenticated',
    'existing-list-smoke@app-piteco.local',
    crypt('smoke-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Existing List Smoke","requested_account_type":"teacher","requested_public_slug":"existing_list_smoke"}'::jsonb,
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', smoke_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.folders(
    owner_id, title, visibility, study_type,
    lang_a, lang_b, labels_a, labels_b, tts_enabled
  ) VALUES (
    smoke_user, 'Existing Destination Folder', 'private', 'language',
    'en', 'pt-BR', 'Original A', 'Original B', false
  ) RETURNING id INTO v_folder_id;

  INSERT INTO public.lists(
    folder_id, owner_id, title, visibility, study_type,
    lang, lang_a, lang_b, labels_a, labels_b, tts_enabled
  ) VALUES (
    v_folder_id, smoke_user, 'Existing Destination List', 'private', 'language',
    'en', 'en', 'pt-BR', 'Original A', 'Original B', false
  ) RETURNING id INTO v_list_id;

  INSERT INTO public.flashcards(
    list_id, user_id, term, translation, detailed_explanation
  ) VALUES (
    v_list_id, smoke_user, 'Hello', 'Olá', 'old explanation'
  ) RETURNING id INTO v_existing_card_id;

  v_payload := jsonb_build_object(
    'schema', 'app-piteco-super-import',
    'version', '2.0',
    'package', jsonb_build_object(
      'name', 'Existing List Consolidation',
      'source_language', 'en',
      'target_language', 'pt-BR',
      'folders', jsonb_build_array(
        jsonb_build_object(
          'name', 'Source Folder One',
          'lists', jsonb_build_array(
            jsonb_build_object(
              'name', 'Source List One',
              'front_language', 'en',
              'back_language', 'pt-BR',
              'primary_side', 'a',
              'study_type', 'visual',
              'label_a', 'Injected A',
              'label_b', 'Injected B',
              'tts_enabled', true,
              'glossary', '[]'::jsonb,
              'cards', jsonb_build_array(
                jsonb_build_object(
                  'type', 'normal',
                  'front', 'Hello',
                  'back', 'Olá',
                  'detailed_explanation', 'new explanation'
                )
              )
            )
          )
        ),
        jsonb_build_object(
          'name', 'Source Folder Two',
          'lists', jsonb_build_array(
            jsonb_build_object(
              'name', 'Source List Two',
              'front_language', 'en',
              'back_language', 'pt-BR',
              'primary_side', 'a',
              'study_type', 'math',
              'label_a', 'Another A',
              'label_b', 'Another B',
              'tts_enabled', true,
              'glossary', '[]'::jsonb,
              'cards', jsonb_build_array(
                jsonb_build_object(
                  'type', 'normal',
                  'front', 'Receipt',
                  'back', 'Recibo'
                )
              )
            )
          )
        )
      )
    )
  );

  v_destination_plan := jsonb_build_object(
    'folders', jsonb_build_object(
      '0', jsonb_build_object(
        'folder', jsonb_build_object('mode', 'existing', 'folderId', v_folder_id),
        'lists', jsonb_build_object(
          '0', jsonb_build_object(
            'mode', 'existing', 'listId', v_list_id,
            'strategy', 'append', 'consolidate', true
          )
        )
      ),
      '1', jsonb_build_object(
        'folder', jsonb_build_object('mode', 'existing', 'folderId', v_folder_id),
        'lists', jsonb_build_object(
          '0', jsonb_build_object(
            'mode', 'existing', 'listId', v_list_id,
            'strategy', 'append', 'consolidate', true
          )
        )
      )
    )
  );

  SELECT public.import_app_piteco_super_package_v3(
    '92222222-2222-4222-8222-222222222222',
    v_payload,
    v_destination_plan,
    'replace',
    NULL
  ) INTO v_report;

  v_batch_id := (v_report->>'batch_id')::uuid;

  IF COALESCE((v_report->>'cards_created')::integer, 0) <> 1
     OR COALESCE((v_report->>'cards_updated')::integer, 0) <> 1
     OR COALESCE((v_report->>'cards_skipped')::integer, 0) <> 0 THEN
    RAISE EXCEPTION 'Unexpected replace report: %', v_report;
  END IF;

  IF (SELECT f.detailed_explanation FROM public.flashcards f WHERE f.id = v_existing_card_id) <> 'new explanation' THEN
    RAISE EXCEPTION 'The duplicate card was not updated.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.list_id = v_list_id
      AND f.user_id = smoke_user
      AND f.term = 'Receipt'
      AND f.translation = 'Recibo'
      AND f.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The second source list was not consolidated.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = v_list_id
      AND (
        l.folder_id IS DISTINCT FROM v_folder_id
        OR l.owner_id IS DISTINCT FROM smoke_user
        OR l.study_type IS DISTINCT FROM 'language'
        OR l.lang_a IS DISTINCT FROM 'en'
        OR l.lang_b IS DISTINCT FROM 'pt-BR'
        OR l.labels_a IS DISTINCT FROM 'Original A'
        OR l.labels_b IS DISTINCT FROM 'Original B'
        OR l.tts_enabled IS DISTINCT FROM false
      )
  ) THEN
    RAISE EXCEPTION 'The package changed authoritative destination settings.';
  END IF;

  PERFORM public.undo_global_import_v2(v_batch_id);

  IF (SELECT f.detailed_explanation FROM public.flashcards f WHERE f.id = v_existing_card_id) <> 'old explanation' THEN
    RAISE EXCEPTION 'Undo did not restore the previous duplicate content.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.list_id = v_list_id
      AND f.user_id = smoke_user
      AND f.term = 'Receipt'
      AND f.translation = 'Recibo'
      AND f.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Undo did not remove the newly consolidated card.';
  END IF;
END;
$$;
