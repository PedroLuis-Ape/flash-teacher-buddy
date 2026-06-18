-- Canonical ape-global-import protocol. This wrapper validates the public payload,
-- converts it to the established internal transport and delegates persistence to
-- the already transactional import_global_package_v1 function.

CREATE OR REPLACE FUNCTION public.global_import_json_has_forbidden_key(_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  pair record;
  child jsonb;
BEGIN
  IF jsonb_typeof(_value) = 'object' THEN
    FOR pair IN SELECT key, value FROM jsonb_each(_value) LOOP
      IF pair.key IN (
        '__proto__', 'prototype', 'constructor',
        'owner_id', 'user_id', 'institution_id',
        'folder_id', 'list_id', 'parent_card_id',
        'created_at', 'updated_at', 'deleted_at'
      ) THEN
        RETURN true;
      END IF;
      IF public.global_import_json_has_forbidden_key(pair.value) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(_value) = 'array' THEN
    FOR child IN SELECT value FROM jsonb_array_elements(_value) LOOP
      IF public.global_import_json_has_forbidden_key(child) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_global_package_v2(
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
  payload_request_id uuid;
  legacy_payload jsonb;
  result jsonb;
  batch_uuid uuid;
  study jsonb;
  fr record;
  lr record;
  cr record;
  folder_path text;
  list_path text;
  card_path text;
  folder_card_count integer;
  total_lists integer := 0;
  total_cards integer := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL THEN
    RAISE EXCEPTION 'request_id é obrigatório.';
  END IF;
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION '$: o pacote precisa ser um objeto JSON.';
  END IF;
  IF public.global_import_json_has_forbidden_key(_payload) THEN
    RAISE EXCEPTION '$: o pacote contém uma chave reservada ou identificador de banco.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_payload) AS key
    WHERE key NOT IN ('format', 'schema_version', 'request_id', 'package')
  ) THEN
    RAISE EXCEPTION '$: campo desconhecido no pacote.';
  END IF;
  IF _payload->>'format' IS DISTINCT FROM 'ape-global-import' THEN
    RAISE EXCEPTION 'format: formato incompatível.';
  END IF;
  IF COALESCE((_payload->>'schema_version')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'schema_version: versão incompatível.';
  END IF;

  BEGIN
    payload_request_id := (_payload->>'request_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'request_id: UUID inválido.';
  END;
  IF payload_request_id IS DISTINCT FROM _request_id THEN
    RAISE EXCEPTION 'request_id: não corresponde à solicitação enviada.';
  END IF;

  IF jsonb_typeof(_payload->'package') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'package: objeto obrigatório.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_payload->'package') AS key
    WHERE key NOT IN (
      'title', 'description', 'study_settings',
      'expected_folder_count', 'expected_list_count', 'expected_card_count', 'folders'
    )
  ) THEN
    RAISE EXCEPTION 'package: campo desconhecido.';
  END IF;
  IF NULLIF(BTRIM(_payload #>> '{package,title}'), '') IS NULL
     OR char_length(_payload #>> '{package,title}') > 160 THEN
    RAISE EXCEPTION 'package.title: título obrigatório ou acima do limite.';
  END IF;
  IF COALESCE(char_length(_payload #>> '{package,description}'), 0) > 8000 THEN
    RAISE EXCEPTION 'package.description: descrição acima do limite.';
  END IF;

  study := _payload #> '{package,study_settings}';
  IF jsonb_typeof(study) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'package.study_settings: objeto obrigatório.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(study) AS key
    WHERE key NOT IN ('study_type', 'lang_a', 'lang_b', 'labels_a', 'labels_b', 'tts_enabled')
  ) THEN
    RAISE EXCEPTION 'package.study_settings: campo desconhecido.';
  END IF;
  IF study->>'study_type' NOT IN ('language', 'general', 'math', 'visual') THEN
    RAISE EXCEPTION 'package.study_settings.study_type: valor inválido.';
  END IF;
  IF NULLIF(BTRIM(study->>'lang_a'), '') IS NULL OR char_length(study->>'lang_a') > 80 THEN
    RAISE EXCEPTION 'package.study_settings.lang_a: valor inválido.';
  END IF;
  IF NULLIF(BTRIM(study->>'lang_b'), '') IS NULL OR char_length(study->>'lang_b') > 80 THEN
    RAISE EXCEPTION 'package.study_settings.lang_b: valor inválido.';
  END IF;
  IF NULLIF(BTRIM(study->>'labels_a'), '') IS NULL OR char_length(study->>'labels_a') > 120 THEN
    RAISE EXCEPTION 'package.study_settings.labels_a: valor inválido.';
  END IF;
  IF NULLIF(BTRIM(study->>'labels_b'), '') IS NULL OR char_length(study->>'labels_b') > 120 THEN
    RAISE EXCEPTION 'package.study_settings.labels_b: valor inválido.';
  END IF;
  IF jsonb_typeof(study->'tts_enabled') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'package.study_settings.tts_enabled: booleano obrigatório.';
  END IF;

  IF jsonb_typeof(_payload #> '{package,folders}') IS DISTINCT FROM 'array'
     OR jsonb_array_length(_payload #> '{package,folders}') = 0 THEN
    RAISE EXCEPTION 'package.folders: array não vazio obrigatório.';
  END IF;
  IF jsonb_array_length(_payload #> '{package,folders}') > 100 THEN
    RAISE EXCEPTION 'package.folders: limite de 100 pastas excedido.';
  END IF;
  IF COALESCE((_payload #>> '{package,expected_folder_count}')::integer, -1)
     <> jsonb_array_length(_payload #> '{package,folders}') THEN
    RAISE EXCEPTION 'package.expected_folder_count: contagem divergente.';
  END IF;

  FOR fr IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_payload #> '{package,folders}') WITH ORDINALITY
  LOOP
    folder_path := format('package.folders[%s]', fr.ordinality - 1);
    IF jsonb_typeof(fr.value) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION '%: objeto obrigatório.', folder_path;
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(fr.value) AS key
      WHERE key NOT IN (
        'title', 'description', 'order_index',
        'expected_list_count', 'expected_card_count', 'lists'
      )
    ) THEN
      RAISE EXCEPTION '%: campo desconhecido.', folder_path;
    END IF;
    IF NULLIF(BTRIM(fr.value->>'title'), '') IS NULL OR char_length(fr.value->>'title') > 160 THEN
      RAISE EXCEPTION '%.title: título obrigatório ou acima do limite.', folder_path;
    END IF;
    IF COALESCE(char_length(fr.value->>'description'), 0) > 8000 THEN
      RAISE EXCEPTION '%.description: descrição acima do limite.', folder_path;
    END IF;
    IF COALESCE((fr.value->>'order_index')::integer, -1) <> fr.ordinality - 1 THEN
      RAISE EXCEPTION '%.order_index: ordem divergente.', folder_path;
    END IF;
    IF jsonb_typeof(fr.value->'lists') IS DISTINCT FROM 'array'
       OR jsonb_array_length(fr.value->'lists') = 0 THEN
      RAISE EXCEPTION '%.lists: array não vazio obrigatório.', folder_path;
    END IF;
    IF COALESCE((fr.value->>'expected_list_count')::integer, -1)
       <> jsonb_array_length(fr.value->'lists') THEN
      RAISE EXCEPTION '%.expected_list_count: contagem divergente.', folder_path;
    END IF;

    folder_card_count := 0;
    FOR lr IN
      SELECT value, ordinality
      FROM jsonb_array_elements(fr.value->'lists') WITH ORDINALITY
    LOOP
      total_lists := total_lists + 1;
      IF total_lists > 500 THEN
        RAISE EXCEPTION 'package.folders: limite de 500 listas excedido.';
      END IF;
      list_path := format('%s.lists[%s]', folder_path, lr.ordinality - 1);
      IF jsonb_typeof(lr.value) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION '%: objeto obrigatório.', list_path;
      END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_object_keys(lr.value) AS key
        WHERE key NOT IN ('title', 'description', 'order_index', 'expected_card_count', 'cards')
      ) THEN
        RAISE EXCEPTION '%: campo desconhecido.', list_path;
      END IF;
      IF NULLIF(BTRIM(lr.value->>'title'), '') IS NULL OR char_length(lr.value->>'title') > 160 THEN
        RAISE EXCEPTION '%.title: título obrigatório ou acima do limite.', list_path;
      END IF;
      IF COALESCE(char_length(lr.value->>'description'), 0) > 8000 THEN
        RAISE EXCEPTION '%.description: descrição acima do limite.', list_path;
      END IF;
      IF COALESCE((lr.value->>'order_index')::integer, -1) <> lr.ordinality - 1 THEN
        RAISE EXCEPTION '%.order_index: ordem divergente.', list_path;
      END IF;
      IF jsonb_typeof(lr.value->'cards') IS DISTINCT FROM 'array'
         OR jsonb_array_length(lr.value->'cards') = 0 THEN
        RAISE EXCEPTION '%.cards: array não vazio obrigatório.', list_path;
      END IF;
      IF COALESCE((lr.value->>'expected_card_count')::integer, -1)
         <> jsonb_array_length(lr.value->'cards') THEN
        RAISE EXCEPTION '%.expected_card_count: contagem divergente.', list_path;
      END IF;

      folder_card_count := folder_card_count + jsonb_array_length(lr.value->'cards');
      FOR cr IN
        SELECT value, ordinality
        FROM jsonb_array_elements(lr.value->'cards') WITH ORDINALITY
      LOOP
        total_cards := total_cards + 1;
        IF total_cards > 5000 THEN
          RAISE EXCEPTION 'package.folders: limite de 5.000 cards excedido.';
        END IF;
        card_path := format('%s.cards[%s]', list_path, cr.ordinality - 1);
        IF jsonb_typeof(cr.value) IS DISTINCT FROM 'object' THEN
          RAISE EXCEPTION '%: objeto obrigatório.', card_path;
        END IF;
        IF EXISTS (
          SELECT 1 FROM jsonb_object_keys(cr.value) AS key
          WHERE key NOT IN (
            'type', 'term', 'translation', 'hint',
            'example_text', 'example_translation',
            'detailed_explanation', 'usage_notes', 'common_mistakes'
          )
        ) THEN
          RAISE EXCEPTION '%: campo desconhecido.', card_path;
        END IF;
        IF cr.value->>'type' IS DISTINCT FROM 'normal' THEN
          RAISE EXCEPTION '%.type: somente normal é aceito nesta versão.', card_path;
        END IF;
        IF NULLIF(BTRIM(cr.value->>'term'), '') IS NULL OR char_length(cr.value->>'term') > 8000 THEN
          RAISE EXCEPTION '%.term: campo obrigatório vazio ou acima do limite.', card_path;
        END IF;
        IF NULLIF(BTRIM(cr.value->>'translation'), '') IS NULL OR char_length(cr.value->>'translation') > 8000 THEN
          RAISE EXCEPTION '%.translation: campo obrigatório vazio ou acima do limite.', card_path;
        END IF;
        IF COALESCE(char_length(cr.value->>'hint'), 0) > 16000
           OR COALESCE(char_length(cr.value->>'example_text'), 0) > 16000
           OR COALESCE(char_length(cr.value->>'example_translation'), 0) > 16000
           OR COALESCE(char_length(cr.value->>'detailed_explanation'), 0) > 16000
           OR COALESCE(char_length(cr.value->>'usage_notes'), 0) > 16000
           OR COALESCE(char_length(cr.value->>'common_mistakes'), 0) > 16000 THEN
          RAISE EXCEPTION '%: campo opcional acima do limite.', card_path;
        END IF;
      END LOOP;
    END LOOP;

    IF COALESCE((fr.value->>'expected_card_count')::integer, -1) <> folder_card_count THEN
      RAISE EXCEPTION '%.expected_card_count: contagem divergente.', folder_path;
    END IF;
  END LOOP;

  IF COALESCE((_payload #>> '{package,expected_list_count}')::integer, -1) <> total_lists THEN
    RAISE EXCEPTION 'package.expected_list_count: contagem divergente.';
  END IF;
  IF COALESCE((_payload #>> '{package,expected_card_count}')::integer, -1) <> total_cards THEN
    RAISE EXCEPTION 'package.expected_card_count: contagem divergente.';
  END IF;

  SELECT jsonb_build_object(
    'schema', 'appteco-global-import',
    'version', 1,
    'request_id', _request_id,
    'package', jsonb_build_object(
      'name', _payload #>> '{package,title}',
      'description', _payload #> '{package,description}',
      'source_language', study->>'lang_a',
      'target_language', study->>'lang_b',
      'study_settings', study,
      'expected_folders', _payload #> '{package,expected_folder_count}',
      'expected_lists', _payload #> '{package,expected_list_count}',
      'expected_cards', _payload #> '{package,expected_card_count}',
      'folders', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', f.value->>'title',
            'description', f.value->'description',
            'order_index', f.value->'order_index',
            'expected_lists', f.value->'expected_list_count',
            'expected_cards', f.value->'expected_card_count',
            'lists', (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'name', l.value->>'title',
                  'description', l.value->'description',
                  'order_index', l.value->'order_index',
                  'expected_cards', l.value->'expected_card_count',
                  'cards', (
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'front', c.value->>'term',
                        'back', c.value->>'translation',
                        'hint', c.value->'hint',
                        'example', c.value->'example_text',
                        'example_translation', c.value->'example_translation',
                        'detailed_explanation', c.value->'detailed_explanation',
                        'usage_notes', c.value->'usage_notes',
                        'common_mistakes', c.value->'common_mistakes'
                      ) ORDER BY c.ordinality
                    )
                    FROM jsonb_array_elements(l.value->'cards') WITH ORDINALITY AS c(value, ordinality)
                  )
                ) ORDER BY l.ordinality
              )
              FROM jsonb_array_elements(f.value->'lists') WITH ORDINALITY AS l(value, ordinality)
            )
          ) ORDER BY f.ordinality
        )
        FROM jsonb_array_elements(_payload #> '{package,folders}') WITH ORDINALITY AS f(value, ordinality)
      )
    )
  ) INTO legacy_payload;

  result := public.import_global_package_v1(
    _request_id,
    legacy_payload,
    _destination_plan,
    _card_conflict,
    _institution_id
  );
  batch_uuid := (result->>'batch_id')::uuid;

  UPDATE public.folders AS target
  SET study_type = study->>'study_type',
      lang_a = study->>'lang_a',
      lang_b = study->>'lang_b',
      labels_a = study->>'labels_a',
      labels_b = study->>'labels_b',
      tts_enabled = (study->>'tts_enabled')::boolean
  FROM public.global_import_items AS item
  WHERE item.batch_id = batch_uuid
    AND item.user_id = uid
    AND item.entity_type = 'folder'
    AND item.action = 'created'
    AND item.entity_id = target.id;

  UPDATE public.lists AS target
  SET study_type = study->>'study_type',
      lang_a = study->>'lang_a',
      lang_b = study->>'lang_b',
      labels_a = study->>'labels_a',
      labels_b = study->>'labels_b',
      tts_enabled = (study->>'tts_enabled')::boolean
  FROM public.global_import_items AS item
  WHERE item.batch_id = batch_uuid
    AND item.user_id = uid
    AND item.entity_type = 'list'
    AND item.action = 'created'
    AND item.entity_id = target.id;

  FOR fr IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_payload #> '{package,folders}') WITH ORDINALITY
  LOOP
    folder_path := format('package.folders[%s]', fr.ordinality - 1);
    FOR lr IN
      SELECT value, ordinality
      FROM jsonb_array_elements(fr.value->'lists') WITH ORDINALITY
    LOOP
      list_path := format('%s.lists[%s]', folder_path, lr.ordinality - 1);
      FOR cr IN
        SELECT value, ordinality
        FROM jsonb_array_elements(lr.value->'cards') WITH ORDINALITY
      LOOP
        card_path := format('%s.cards[%s]', list_path, cr.ordinality - 1);
        UPDATE public.flashcards AS target
        SET detailed_explanation = NULLIF(BTRIM(cr.value->>'detailed_explanation'), ''),
            usage_notes = NULLIF(BTRIM(cr.value->>'usage_notes'), ''),
            common_mistakes = NULLIF(BTRIM(cr.value->>'common_mistakes'), '')
        FROM public.global_import_items AS item
        WHERE item.batch_id = batch_uuid
          AND item.user_id = uid
          AND item.entity_type = 'card'
          AND item.action = 'created'
          AND item.item_path = card_path
          AND item.entity_id = target.id;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN result || jsonb_build_object(
    'format', 'ape-global-import',
    'schema_version', 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.global_import_json_has_forbidden_key(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_global_package_v2(uuid, jsonb, jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_global_package_v2(uuid, jsonb, jsonb, text, uuid) TO authenticated;
