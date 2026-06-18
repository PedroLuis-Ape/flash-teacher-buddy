-- Official app-piteco-super-import 1.0 transactional importer.
-- The legacy RPCs remain available as compatibility adapters.

CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_v1(
  _request_id uuid,
  _payload jsonb,
  _destination_plan jsonb,
  _card_conflict text DEFAULT 'skip',
  _institution_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  batch_id uuid;
  existing_batch public.global_import_batches%ROWTYPE;
  payload_hash text;
  package_name text;
  fr record;
  lr record;
  cr record;
  fp jsonb;
  lp jsonb;
  folder_id uuid;
  list_id uuid;
  card_id uuid;
  folder_name text;
  list_name text;
  front_text text;
  back_text text;
  front_language text;
  back_language text;
  existing_lang_a text;
  existing_lang_b text;
  next_order integer;
  folder_cards integer;
  validated_folders integer := 0;
  validated_lists integer := 0;
  validated_cards integer := 0;
  folders_created integer := 0;
  folders_reused integer := 0;
  lists_created integer := 0;
  lists_reused integer := 0;
  lists_replaced integer := 0;
  lists_skipped integer := 0;
  cards_created integer := 0;
  cards_skipped integer := 0;
  duplicate_found boolean;
  folder_path text;
  list_path text;
  card_path text;
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL THEN
    RAISE EXCEPTION 'request_id é obrigatório.';
  END IF;
  IF _card_conflict NOT IN ('skip', 'copy', 'error') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'E_SCHEMA|$: o pacote precisa ser um objeto JSON.';
  END IF;
  IF public.global_import_json_has_forbidden_key(_payload) THEN
    RAISE EXCEPTION 'E_SCHEMA|$: o pacote contém uma chave reservada ou identificador de banco.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_payload) AS key
    WHERE key NOT IN ('schema', 'version', 'declared_totals', 'package')
  ) THEN
    RAISE EXCEPTION 'E_SCHEMA|$: campo desconhecido no pacote.';
  END IF;
  IF _payload->>'schema' IS DISTINCT FROM 'app-piteco-super-import' THEN
    RAISE EXCEPTION 'E_SCHEMA|schema: contrato incompatível.';
  END IF;
  IF _payload->>'version' IS DISTINCT FROM '1.0' THEN
    RAISE EXCEPTION 'E_VERSION|version: versão incompatível.';
  END IF;
  IF jsonb_typeof(_payload->'declared_totals') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'E_SCHEMA|declared_totals: objeto obrigatório.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_payload->'declared_totals') AS key
    WHERE key NOT IN ('folders', 'lists', 'cards')
  ) THEN
    RAISE EXCEPTION 'E_SCHEMA|declared_totals: campo desconhecido.';
  END IF;
  IF jsonb_typeof(_payload->'package') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'E_SCHEMA|package: objeto obrigatório.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_payload->'package') AS key
    WHERE key NOT IN ('name', 'folders')
  ) THEN
    RAISE EXCEPTION 'E_SCHEMA|package: campo desconhecido.';
  END IF;

  package_name := NULLIF(BTRIM(_payload #>> '{package,name}'), '');
  IF package_name IS NULL OR char_length(package_name) > 120 THEN
    RAISE EXCEPTION 'E_EMPTY_NAME|package.name: nome obrigatório ou acima de 120 caracteres.';
  END IF;
  IF jsonb_typeof(_payload #> '{package,folders}') IS DISTINCT FROM 'array'
     OR jsonb_array_length(_payload #> '{package,folders}') = 0 THEN
    RAISE EXCEPTION 'E_SCHEMA|package.folders: array não vazio obrigatório.';
  END IF;
  IF jsonb_array_length(_payload #> '{package,folders}') > 200 THEN
    RAISE EXCEPTION 'E_LIMIT|package.folders: limite de 200 pastas excedido.';
  END IF;
  IF jsonb_typeof(_destination_plan->'folders') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'E_CONFLICT|destination_plan: plano de destinos inválido.';
  END IF;
  IF _institution_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.institutions WHERE id = _institution_id AND owner_id = uid
  ) THEN
    RAISE EXCEPTION 'Instituição inválida ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  -- Validate the entire contract before creating the import batch.
  FOR fr IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_payload #> '{package,folders}') WITH ORDINALITY
  LOOP
    validated_folders := validated_folders + 1;
    folder_path := format('package.folders[%s]', fr.ordinality - 1);
    IF jsonb_typeof(fr.value) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'E_SCHEMA|%: objeto obrigatório.', folder_path;
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(fr.value) AS key
      WHERE key NOT IN ('name', 'declared_totals', 'lists')
    ) THEN
      RAISE EXCEPTION 'E_SCHEMA|%: campo desconhecido.', folder_path;
    END IF;
    IF NULLIF(BTRIM(fr.value->>'name'), '') IS NULL OR char_length(fr.value->>'name') > 120 THEN
      RAISE EXCEPTION 'E_EMPTY_NAME|%.name: nome obrigatório ou acima de 120 caracteres.', folder_path;
    END IF;
    IF jsonb_typeof(fr.value->'declared_totals') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'E_SCHEMA|%.declared_totals: objeto obrigatório.', folder_path;
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(fr.value->'declared_totals') AS key
      WHERE key NOT IN ('lists', 'cards')
    ) THEN
      RAISE EXCEPTION 'E_SCHEMA|%.declared_totals: campo desconhecido.', folder_path;
    END IF;
    IF jsonb_typeof(fr.value->'lists') IS DISTINCT FROM 'array'
       OR jsonb_array_length(fr.value->'lists') = 0 THEN
      RAISE EXCEPTION 'E_SCHEMA|%.lists: array não vazio obrigatório.', folder_path;
    END IF;
    IF jsonb_array_length(fr.value->'lists') > 500 THEN
      RAISE EXCEPTION 'E_LIMIT|%.lists: limite de 500 listas excedido.', folder_path;
    END IF;
    IF COALESCE((fr.value #>> '{declared_totals,lists}')::integer, -1)
       <> jsonb_array_length(fr.value->'lists') THEN
      RAISE EXCEPTION 'E_COUNT_MISMATCH|%.declared_totals.lists: contagem divergente.', folder_path;
    END IF;

    folder_cards := 0;
    FOR lr IN
      SELECT value, ordinality
      FROM jsonb_array_elements(fr.value->'lists') WITH ORDINALITY
    LOOP
      validated_lists := validated_lists + 1;
      IF validated_lists > 1000 THEN
        RAISE EXCEPTION 'E_LIMIT|package.folders: limite de 1.000 listas excedido.';
      END IF;
      list_path := format('%s.lists[%s]', folder_path, lr.ordinality - 1);
      IF jsonb_typeof(lr.value) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'E_SCHEMA|%: objeto obrigatório.', list_path;
      END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_object_keys(lr.value) AS key
        WHERE key NOT IN ('name', 'front_language', 'back_language', 'declared_card_count', 'cards')
      ) THEN
        RAISE EXCEPTION 'E_SCHEMA|%: campo desconhecido.', list_path;
      END IF;
      IF NULLIF(BTRIM(lr.value->>'name'), '') IS NULL OR char_length(lr.value->>'name') > 120 THEN
        RAISE EXCEPTION 'E_EMPTY_NAME|%.name: nome obrigatório ou acima de 120 caracteres.', list_path;
      END IF;
      front_language := lr.value->>'front_language';
      back_language := lr.value->>'back_language';
      IF front_language IS NULL
         OR front_language !~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$' THEN
        RAISE EXCEPTION 'E_LANGUAGE|%.front_language: código BCP 47 inválido.', list_path;
      END IF;
      IF back_language IS NULL
         OR back_language !~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$' THEN
        RAISE EXCEPTION 'E_LANGUAGE|%.back_language: código BCP 47 inválido.', list_path;
      END IF;
      IF jsonb_typeof(lr.value->'cards') IS DISTINCT FROM 'array'
         OR jsonb_array_length(lr.value->'cards') = 0 THEN
        RAISE EXCEPTION 'E_SCHEMA|%.cards: array não vazio obrigatório.', list_path;
      END IF;
      IF jsonb_array_length(lr.value->'cards') > 5000 THEN
        RAISE EXCEPTION 'E_LIMIT|%.cards: limite de 5.000 cards excedido.', list_path;
      END IF;
      IF COALESCE((lr.value->>'declared_card_count')::integer, -1)
         <> jsonb_array_length(lr.value->'cards') THEN
        RAISE EXCEPTION 'E_COUNT_MISMATCH|%.declared_card_count: contagem divergente.', list_path;
      END IF;
      IF EXISTS (
        SELECT 1
        FROM (
          SELECT LOWER(BTRIM(card.value->>'front')) AS front_key,
                 LOWER(BTRIM(card.value->>'back')) AS back_key,
                 COUNT(*)
          FROM jsonb_array_elements(lr.value->'cards') AS card(value)
          GROUP BY 1, 2
          HAVING COUNT(*) > 1
        ) AS duplicate
      ) THEN
        RAISE EXCEPTION 'E_DUPLICATE_CARD|%: há cards duplicados na mesma lista.', list_path;
      END IF;

      folder_cards := folder_cards + jsonb_array_length(lr.value->'cards');
      validated_cards := validated_cards + jsonb_array_length(lr.value->'cards');
      IF validated_cards > 20000 THEN
        RAISE EXCEPTION 'E_LIMIT|package.folders: limite de 20.000 cards excedido.';
      END IF;

      FOR cr IN
        SELECT value, ordinality
        FROM jsonb_array_elements(lr.value->'cards') WITH ORDINALITY
      LOOP
        card_path := format('%s.cards[%s]', list_path, cr.ordinality - 1);
        IF jsonb_typeof(cr.value) IS DISTINCT FROM 'object' THEN
          RAISE EXCEPTION 'E_SCHEMA|%: objeto obrigatório.', card_path;
        END IF;
        IF EXISTS (
          SELECT 1 FROM jsonb_object_keys(cr.value) AS key
          WHERE key NOT IN ('front', 'back')
        ) THEN
          RAISE EXCEPTION 'E_SCHEMA|%: somente front e back são permitidos.', card_path;
        END IF;
        IF jsonb_typeof(cr.value->'front') IS DISTINCT FROM 'string'
           OR NULLIF(BTRIM(cr.value->>'front'), '') IS NULL
           OR char_length(cr.value->>'front') > 2000 THEN
          RAISE EXCEPTION 'E_EMPTY_CARD_SIDE|%.front: campo vazio ou acima de 2.000 caracteres.', card_path;
        END IF;
        IF jsonb_typeof(cr.value->'back') IS DISTINCT FROM 'string'
           OR NULLIF(BTRIM(cr.value->>'back'), '') IS NULL
           OR char_length(cr.value->>'back') > 2000 THEN
          RAISE EXCEPTION 'E_EMPTY_CARD_SIDE|%.back: campo vazio ou acima de 2.000 caracteres.', card_path;
        END IF;
      END LOOP;
    END LOOP;

    IF COALESCE((fr.value #>> '{declared_totals,cards}')::integer, -1) <> folder_cards THEN
      RAISE EXCEPTION 'E_COUNT_MISMATCH|%.declared_totals.cards: contagem divergente.', folder_path;
    END IF;
  END LOOP;

  IF COALESCE((_payload #>> '{declared_totals,folders}')::integer, -1) <> validated_folders THEN
    RAISE EXCEPTION 'E_COUNT_MISMATCH|declared_totals.folders: contagem divergente.';
  END IF;
  IF COALESCE((_payload #>> '{declared_totals,lists}')::integer, -1) <> validated_lists THEN
    RAISE EXCEPTION 'E_COUNT_MISMATCH|declared_totals.lists: contagem divergente.';
  END IF;
  IF COALESCE((_payload #>> '{declared_totals,cards}')::integer, -1) <> validated_cards THEN
    RAISE EXCEPTION 'E_COUNT_MISMATCH|declared_totals.cards: contagem divergente.';
  END IF;

  payload_hash := md5(
    _payload::text || '|' || _destination_plan::text || '|' || _card_conflict || '|' || COALESCE(_institution_id::text, '')
  );
  SELECT * INTO existing_batch
  FROM public.global_import_batches
  WHERE user_id = uid AND request_id = _request_id;
  IF FOUND THEN
    IF existing_batch.payload_hash <> payload_hash THEN
      RAISE EXCEPTION 'request_id já usado com outro pacote.';
    END IF;
    IF existing_batch.status = 'undone' THEN
      RAISE EXCEPTION 'Esta importação já foi desfeita. Inicie outra tentativa.';
    END IF;
    RETURN existing_batch.summary || jsonb_build_object(
      'batch_id', existing_batch.id,
      'request_id', existing_batch.request_id,
      'status', existing_batch.status
    );
  END IF;

  INSERT INTO public.global_import_batches(
    user_id, request_id, payload_hash, package_name, schema_version, status, options
  ) VALUES (
    uid,
    _request_id,
    payload_hash,
    package_name,
    1,
    'processing',
    jsonb_build_object(
      'schema', 'app-piteco-super-import',
      'version', '1.0',
      'card_conflict', _card_conflict,
      'destination_plan', _destination_plan,
      'institution_id', _institution_id
    )
  )
  ON CONFLICT (user_id, request_id) DO NOTHING
  RETURNING id INTO batch_id;

  IF batch_id IS NULL THEN
    SELECT * INTO existing_batch
    FROM public.global_import_batches
    WHERE user_id = uid AND request_id = _request_id;
    IF existing_batch.payload_hash <> payload_hash THEN
      RAISE EXCEPTION 'request_id já usado com outro pacote.';
    END IF;
    RETURN existing_batch.summary || jsonb_build_object(
      'batch_id', existing_batch.id,
      'request_id', existing_batch.request_id,
      'status', existing_batch.status
    );
  END IF;

  -- Persist only after the complete package has passed validation.
  FOR fr IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_payload #> '{package,folders}') WITH ORDINALITY
  LOOP
    folder_path := format('package.folders[%s]', fr.ordinality - 1);
    fp := _destination_plan #> ARRAY['folders', (fr.ordinality - 1)::text];
    IF jsonb_typeof(fp) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'E_CONFLICT|%: destino ausente.', folder_path;
    END IF;
    front_language := fr.value #>> '{lists,0,front_language}';
    back_language := fr.value #>> '{lists,0,back_language}';

    IF fp #>> '{folder,mode}' = 'existing' THEN
      folder_id := (fp #>> '{folder,folderId}')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.folders
        WHERE id = folder_id AND owner_id = uid AND deleted_at IS NULL AND class_id IS NULL
      ) THEN
        RAISE EXCEPTION 'E_CONFLICT|%: pasta inválida ou sem permissão.', folder_path USING ERRCODE = '42501';
      END IF;
      folders_reused := folders_reused + 1;
      INSERT INTO public.global_import_items(batch_id, user_id, entity_type, entity_id, action, item_path)
      VALUES(batch_id, uid, 'folder', folder_id, 'reused', folder_path);
    ELSIF fp #>> '{folder,mode}' = 'create' THEN
      folder_name := COALESCE(
        NULLIF(BTRIM(fp #>> '{folder,name}'), ''),
        NULLIF(BTRIM(fr.value->>'name'), '')
      );
      IF folder_name IS NULL OR char_length(folder_name) > 160 THEN
        RAISE EXCEPTION 'E_EMPTY_NAME|%: nome de destino inválido.', folder_path;
      END IF;
      INSERT INTO public.folders(
        owner_id, title, description, visibility, institution_id, lang_a, lang_b
      ) VALUES (
        uid, folder_name, NULL, 'private', _institution_id, front_language, back_language
      ) RETURNING id INTO folder_id;
      folders_created := folders_created + 1;
      INSERT INTO public.global_import_items(batch_id, user_id, entity_type, entity_id, action, item_path)
      VALUES(batch_id, uid, 'folder', folder_id, 'created', folder_path);
    ELSE
      RAISE EXCEPTION 'E_CONFLICT|%: modo de pasta inválido.', folder_path;
    END IF;

    SELECT COALESCE(MAX(order_index), -1) + 1 INTO next_order
    FROM public.lists
    WHERE folder_id = folder_id AND deleted_at IS NULL;

    FOR lr IN
      SELECT value, ordinality
      FROM jsonb_array_elements(fr.value->'lists') WITH ORDINALITY
    LOOP
      list_path := format('%s.lists[%s]', folder_path, lr.ordinality - 1);
      lp := fp #> ARRAY['lists', (lr.ordinality - 1)::text];
      IF jsonb_typeof(lp) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'E_CONFLICT|%: destino ausente.', list_path;
      END IF;
      front_language := lr.value->>'front_language';
      back_language := lr.value->>'back_language';

      IF lp->>'mode' = 'skip' THEN
        lists_skipped := lists_skipped + 1;
        INSERT INTO public.global_import_items(batch_id, user_id, entity_type, entity_id, action, item_path)
        VALUES(batch_id, uid, 'list', NULL, 'skipped', list_path);
        CONTINUE;
      ELSIF lp->>'mode' = 'existing' THEN
        list_id := (lp->>'listId')::uuid;
        SELECT lang_a, lang_b INTO existing_lang_a, existing_lang_b
        FROM public.lists
        WHERE id = list_id AND folder_id = folder_id AND owner_id = uid AND deleted_at IS NULL;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'E_CONFLICT|%: lista inválida ou sem permissão.', list_path USING ERRCODE = '42501';
        END IF;
        IF existing_lang_a IS NOT NULL AND existing_lang_a <> front_language THEN
          RAISE EXCEPTION 'E_CONFLICT|%: o idioma da frente difere da lista existente.', list_path;
        END IF;
        IF existing_lang_b IS NOT NULL AND existing_lang_b <> back_language THEN
          RAISE EXCEPTION 'E_CONFLICT|%: o idioma do verso difere da lista existente.', list_path;
        END IF;
        UPDATE public.lists
        SET lang_a = COALESCE(lang_a, front_language),
            lang_b = COALESCE(lang_b, back_language)
        WHERE id = list_id;

        IF COALESCE(lp->>'strategy', 'append') NOT IN ('append', 'replace') THEN
          RAISE EXCEPTION 'E_CONFLICT|%: estratégia de conflito inválida.', list_path;
        END IF;
        IF COALESCE(lp->>'strategy', 'append') = 'replace' THEN
          INSERT INTO public.global_import_items(
            batch_id, user_id, entity_type, entity_id, action, item_path, metadata
          )
          SELECT batch_id, uid, 'card', flashcard.id, 'replaced', list_path, to_jsonb(flashcard)
          FROM public.flashcards AS flashcard
          WHERE flashcard.list_id = list_id AND flashcard.user_id = uid;
          DELETE FROM public.flashcards WHERE list_id = list_id AND user_id = uid;
          lists_replaced := lists_replaced + 1;
        ELSE
          lists_reused := lists_reused + 1;
        END IF;
        INSERT INTO public.global_import_items(batch_id, user_id, entity_type, entity_id, action, item_path)
        VALUES(
          batch_id,
          uid,
          'list',
          list_id,
          CASE WHEN COALESCE(lp->>'strategy', 'append') = 'replace' THEN 'replaced' ELSE 'reused' END,
          list_path
        );
      ELSIF lp->>'mode' = 'create' THEN
        list_name := COALESCE(
          NULLIF(BTRIM(lp->>'name'), ''),
          NULLIF(BTRIM(lr.value->>'name'), '')
        );
        IF list_name IS NULL OR char_length(list_name) > 160 THEN
          RAISE EXCEPTION 'E_EMPTY_NAME|%: nome de destino inválido.', list_path;
        END IF;
        INSERT INTO public.lists(
          folder_id, owner_id, title, description, order_index, visibility,
          institution_id, lang_a, lang_b
        ) VALUES (
          folder_id, uid, list_name, NULL, next_order, 'private',
          _institution_id, front_language, back_language
        ) RETURNING id INTO list_id;
        next_order := next_order + 1;
        lists_created := lists_created + 1;
        INSERT INTO public.global_import_items(batch_id, user_id, entity_type, entity_id, action, item_path)
        VALUES(batch_id, uid, 'list', list_id, 'created', list_path);
      ELSE
        RAISE EXCEPTION 'E_CONFLICT|%: modo de lista inválido.', list_path;
      END IF;

      FOR cr IN
        SELECT value, ordinality
        FROM jsonb_array_elements(lr.value->'cards') WITH ORDINALITY
      LOOP
        card_path := format('%s.cards[%s]', list_path, cr.ordinality - 1);
        front_text := BTRIM(cr.value->>'front');
        back_text := BTRIM(cr.value->>'back');
        SELECT EXISTS(
          SELECT 1 FROM public.flashcards
          WHERE list_id = list_id
            AND deleted_at IS NULL
            AND LOWER(BTRIM(term)) = LOWER(front_text)
            AND LOWER(BTRIM(translation)) = LOWER(back_text)
        ) INTO duplicate_found;

        IF duplicate_found AND _card_conflict = 'error' THEN
          RAISE EXCEPTION 'E_DUPLICATE_CARD|%: card duplicado na lista de destino.', card_path;
        END IF;
        IF duplicate_found AND _card_conflict = 'skip' THEN
          cards_skipped := cards_skipped + 1;
          INSERT INTO public.global_import_items(batch_id, user_id, entity_type, entity_id, action, item_path)
          VALUES(batch_id, uid, 'card', NULL, 'skipped', card_path);
        ELSE
          INSERT INTO public.flashcards(list_id, user_id, term, translation)
          VALUES(list_id, uid, front_text, back_text)
          RETURNING id INTO card_id;
          cards_created := cards_created + 1;
          INSERT INTO public.global_import_items(batch_id, user_id, entity_type, entity_id, action, item_path)
          VALUES(batch_id, uid, 'card', card_id, 'created', card_path);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  result := jsonb_build_object(
    'batch_id', batch_id,
    'request_id', _request_id,
    'status', 'completed',
    'package_name', package_name,
    'schema', 'app-piteco-super-import',
    'version', '1.0',
    'folders_created', folders_created,
    'folders_reused', folders_reused,
    'lists_created', lists_created,
    'lists_reused', lists_reused,
    'lists_replaced', lists_replaced,
    'lists_skipped', lists_skipped,
    'cards_created', cards_created,
    'cards_skipped', cards_skipped,
    'folders_total', validated_folders,
    'lists_total', validated_lists,
    'cards_total', validated_cards
  );
  UPDATE public.global_import_batches
  SET status = 'completed', summary = result, completed_at = now()
  WHERE id = batch_id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_v1(uuid, jsonb, jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_v1(uuid, jsonb, jsonb, text, uuid) TO authenticated;
