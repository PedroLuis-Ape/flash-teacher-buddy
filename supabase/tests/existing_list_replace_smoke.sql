DO $$
DECLARE
  smoke_user uuid := '93333333-3333-4333-8333-333333333333';
  v_folder_id uuid;
  v_list_id uuid;
  v_old_card_id uuid;
  v_report jsonb;
  v_batch_id uuid;
  v_payload jsonb;
  v_plan jsonb;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', smoke_user,
    'authenticated', 'authenticated', 'existing-list-replace@app-piteco.local', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Replace Smoke","requested_account_type":"teacher","requested_public_slug":"existing_list_replace"}'::jsonb,
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', smoke_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.folders(owner_id, title, visibility, lang_a, lang_b)
  VALUES (smoke_user, 'Replace Folder', 'private', 'en', 'pt-BR')
  RETURNING id INTO v_folder_id;

  INSERT INTO public.lists(
    folder_id, owner_id, title, visibility, study_type, lang_a, lang_b,
    labels_a, labels_b, tts_enabled
  ) VALUES (
    v_folder_id, smoke_user, 'Replace List', 'private', 'language', 'en', 'pt-BR',
    'English', 'Português', false
  ) RETURNING id INTO v_list_id;

  INSERT INTO public.flashcards(list_id, user_id, term, translation, detailed_explanation)
  VALUES (v_list_id, smoke_user, 'Old only', 'Antigo', 'must return after undo')
  RETURNING id INTO v_old_card_id;

  v_payload := jsonb_build_object(
    'schema', 'app-piteco-super-import',
    'version', '2.0',
    'package', jsonb_build_object(
      'name', 'Replace all sources',
      'source_language', 'en',
      'target_language', 'pt-BR',
      'folders', jsonb_build_array(
        jsonb_build_object(
          'name', 'First source',
          'lists', jsonb_build_array(jsonb_build_object(
            'name', 'First list',
            'front_language', 'en', 'back_language', 'pt-BR',
            'primary_side', 'a', 'study_type', 'language', 'tts_enabled', true,
            'glossary', '[]'::jsonb,
            'cards', jsonb_build_array(jsonb_build_object(
              'type', 'normal', 'front', 'First new', 'back', 'Primeiro novo'
            ))
          ))
        ),
        jsonb_build_object(
          'name', 'Second source',
          'lists', jsonb_build_array(jsonb_build_object(
            'name', 'Second list',
            'front_language', 'en', 'back_language', 'pt-BR',
            'primary_side', 'a', 'study_type', 'language', 'tts_enabled', true,
            'glossary', '[]'::jsonb,
            'cards', jsonb_build_array(jsonb_build_object(
              'type', 'normal', 'front', 'Second new', 'back', 'Segundo novo'
            ))
          ))
        )
      )
    )
  );

  v_plan := jsonb_build_object(
    'folders', jsonb_build_object(
      '0', jsonb_build_object(
        'folder', jsonb_build_object('mode', 'existing', 'folderId', v_folder_id),
        'lists', jsonb_build_object('0', jsonb_build_object(
          'mode', 'existing', 'listId', v_list_id,
          'strategy', 'replace', 'consolidate', true
        ))
      ),
      '1', jsonb_build_object(
        'folder', jsonb_build_object('mode', 'existing', 'folderId', v_folder_id),
        'lists', jsonb_build_object('0', jsonb_build_object(
          'mode', 'existing', 'listId', v_list_id,
          'strategy', 'append', 'consolidate', true
        ))
      )
    )
  );

  SELECT public.import_app_piteco_super_package_v3(
    '94444444-4444-4444-8444-444444444444', v_payload, v_plan, 'skip', NULL
  ) INTO v_report;
  v_batch_id := (v_report->>'batch_id')::uuid;

  IF COALESCE((v_report->>'lists_replaced')::integer, 0) <> 1
     OR COALESCE((v_report->>'cards_created')::integer, 0) <> 2 THEN
    RAISE EXCEPTION 'Unexpected full replace report: %', v_report;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.id = v_old_card_id AND f.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The old list content was not replaced.';
  END IF;

  IF (SELECT count(*) FROM public.flashcards f
      WHERE f.list_id = v_list_id AND f.deleted_at IS NULL
        AND f.term IN ('First new', 'Second new')) <> 2 THEN
    RAISE EXCEPTION 'One of the source lists disappeared during consolidation.';
  END IF;

  PERFORM public.undo_global_import_v2(v_batch_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.id = v_old_card_id
      AND f.deleted_at IS NULL
      AND f.detailed_explanation = 'must return after undo'
  ) THEN
    RAISE EXCEPTION 'Undo did not restore the original list content.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.list_id = v_list_id AND f.deleted_at IS NULL
      AND f.term IN ('First new', 'Second new')
  ) THEN
    RAISE EXCEPTION 'Undo left consolidated replacement cards behind.';
  END IF;
END;
$$;
