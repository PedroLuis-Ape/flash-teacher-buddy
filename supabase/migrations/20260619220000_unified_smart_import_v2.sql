-- App Piteco — unified smart import 2.0
-- Restores glossary persistence and installs transactional v2 import RPCs.

BEGIN;

CREATE TABLE IF NOT EXISTS public.list_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  original_text text NOT NULL,
  translated_text text NOT NULL,
  note text,
  side text NOT NULL DEFAULT 'A' CHECK (side IN ('A', 'B')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_list_glossary_list_id
  ON public.list_glossary(list_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_list_glossary_exact_identity
  ON public.list_glossary (
    list_id,
    side,
    lower(btrim(original_text)),
    lower(btrim(translated_text))
  );

ALTER TABLE public.list_glossary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS glossary_owner_all ON public.list_glossary;
CREATE POLICY glossary_owner_all ON public.list_glossary
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lists l
      WHERE l.id = list_glossary.list_id
        AND l.owner_id = auth.uid()
        AND l.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lists l
      WHERE l.id = list_glossary.list_id
        AND l.owner_id = auth.uid()
        AND l.deleted_at IS NULL
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_glossary TO authenticated;

ALTER TABLE public.global_import_batches
  DROP CONSTRAINT IF EXISTS global_import_batches_schema_version_check;
ALTER TABLE public.global_import_batches
  ADD CONSTRAINT global_import_batches_schema_version_check
  CHECK (schema_version IN (1, 2));

ALTER TABLE public.global_import_items
  ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.global_import_items
  DROP CONSTRAINT IF EXISTS global_import_items_entity_type_check;
ALTER TABLE public.global_import_items
  ADD CONSTRAINT global_import_items_entity_type_check
  CHECK (entity_type IN ('folder', 'list', 'card', 'glossary'));

ALTER TABLE public.global_import_items
  DROP CONSTRAINT IF EXISTS global_import_items_action_check;
ALTER TABLE public.global_import_items
  ADD CONSTRAINT global_import_items_action_check
  CHECK (action IN ('created', 'reused', 'skipped', 'updated', 'replaced'));

CREATE OR REPLACE FUNCTION public.smart_word_hints_for_db_v2(_raw jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'text', item->>'text',
          'translation', item->>'translation',
          'note', NULLIF(BTRIM(item->>'note'), ''),
          'side', COALESCE(NULLIF(item->>'side', ''), 'A'),
          'occurrence', COALESCE(item->'occurrence', '"all"'::jsonb),
          'startIndex', item->'start_index',
          'endIndex', item->'end_index'
        )
      )
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(_raw) = 'array' THEN _raw ELSE '[]'::jsonb END
  ) AS item;
$$;

CREATE OR REPLACE FUNCTION public.import_smart_list_content_v2(
  _uid uuid,
  _list_id uuid,
  _list jsonb,
  _card_conflict text DEFAULT 'skip',
  _batch_id uuid DEFAULT NULL,
  _list_path text DEFAULT '$'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_glossary record;
  v_card record;
  v_layer record;
  v_existing_glossary_id uuid;
  v_existing_card_id uuid;
  v_parent_card_id uuid;
  v_created_id uuid;
  v_front text;
  v_back text;
  v_card_path text;
  v_layer_path text;
  v_word_hints jsonb;
  v_cards_created integer := 0;
  v_cards_skipped integer := 0;
  v_groups_created integer := 0;
  v_glossary_created integer := 0;
  v_glossary_updated integer := 0;
  v_layers_created integer;
BEGIN
  IF _uid IS NULL OR _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF _card_conflict NOT IN ('skip', 'copy', 'error') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lists
    WHERE id = _list_id AND owner_id = _uid AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lista inválida ou sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_list) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'E_SCHEMA|%: lista inválida.', _list_path;
  END IF;

  UPDATE public.lists
  SET lang_a = COALESCE(NULLIF(BTRIM(_list->>'front_language'), ''), lang_a),
      lang_b = COALESCE(NULLIF(BTRIM(_list->>'back_language'), ''), lang_b),
      study_type = COALESCE(NULLIF(BTRIM(_list->>'study_type'), ''), study_type),
      labels_a = COALESCE(NULLIF(BTRIM(_list->>'label_a'), ''), labels_a),
      labels_b = COALESCE(NULLIF(BTRIM(_list->>'label_b'), ''), labels_b),
      tts_enabled = COALESCE((_list->>'tts_enabled')::boolean, tts_enabled),
      updated_at = now()
  WHERE id = _list_id;

  FOR v_glossary IN
    SELECT value, ordinality
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(_list->'glossary') = 'array'
        THEN _list->'glossary' ELSE '[]'::jsonb END
    ) WITH ORDINALITY
  LOOP
    IF NULLIF(BTRIM(v_glossary.value->>'term'), '') IS NULL
       OR NULLIF(BTRIM(v_glossary.value->>'translation'), '') IS NULL THEN
      RAISE EXCEPTION 'E_EMPTY_CARD_SIDE|%.glossary[%s]: termo ou tradução vazios.',
        _list_path, v_glossary.ordinality - 1;
    END IF;

    SELECT id INTO v_existing_glossary_id
    FROM public.list_glossary
    WHERE list_id = _list_id
      AND side = CASE WHEN upper(v_glossary.value->>'side') = 'B' THEN 'B' ELSE 'A' END
      AND lower(btrim(original_text)) = lower(btrim(v_glossary.value->>'term'))
      AND lower(btrim(translated_text)) = lower(btrim(v_glossary.value->>'translation'))
    LIMIT 1;

    IF v_existing_glossary_id IS NULL THEN
      INSERT INTO public.list_glossary(
        list_id, original_text, translated_text, note, side, is_active
      ) VALUES (
        _list_id,
        BTRIM(v_glossary.value->>'term'),
        BTRIM(v_glossary.value->>'translation'),
        NULLIF(BTRIM(v_glossary.value->>'note'), ''),
        CASE WHEN upper(v_glossary.value->>'side') = 'B' THEN 'B' ELSE 'A' END,
        COALESCE((v_glossary.value->>'active')::boolean, true)
      ) RETURNING id INTO v_created_id;

      v_glossary_created := v_glossary_created + 1;
      IF _batch_id IS NOT NULL THEN
        INSERT INTO public.global_import_items(
          batch_id, user_id, entity_type, entity_id, action, item_path
        ) VALUES (
          _batch_id, _uid, 'glossary', v_created_id, 'created',
          format('%s.glossary[%s]', _list_path, v_glossary.ordinality - 1)
        );
      END IF;
    ELSE
      IF _batch_id IS NOT NULL THEN
        INSERT INTO public.global_import_items(
          batch_id, user_id, entity_type, entity_id, action, item_path, metadata
        )
        SELECT
          _batch_id, _uid, 'glossary', g.id, 'updated',
          format('%s.glossary[%s]', _list_path, v_glossary.ordinality - 1),
          to_jsonb(g)
        FROM public.list_glossary g
        WHERE g.id = v_existing_glossary_id;
      END IF;

      UPDATE public.list_glossary
      SET note = NULLIF(BTRIM(v_glossary.value->>'note'), ''),
          is_active = COALESCE((v_glossary.value->>'active')::boolean, true),
          updated_at = now()
      WHERE id = v_existing_glossary_id;

      v_glossary_updated := v_glossary_updated + 1;
    END IF;
    v_existing_glossary_id := NULL;
  END LOOP;

  FOR v_card IN
    SELECT value, ordinality
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(_list->'cards') = 'array'
        THEN _list->'cards' ELSE '[]'::jsonb END
    ) WITH ORDINALITY
  LOOP
    v_card_path := format('%s.cards[%s]', _list_path, v_card.ordinality - 1);

    IF COALESCE(v_card.value->>'type', 'normal') = 'layered' THEN
      IF jsonb_typeof(v_card.value->'layers') IS DISTINCT FROM 'array'
         OR jsonb_array_length(v_card.value->'layers') < 2 THEN
        RAISE EXCEPTION 'E_SCHEMA|%: grupo layered exige ao menos duas camadas.', v_card_path;
      END IF;

      v_parent_card_id := NULL;
      v_layers_created := 0;

      FOR v_layer IN
        SELECT value, ordinality
        FROM jsonb_array_elements(v_card.value->'layers') WITH ORDINALITY
      LOOP
        v_layer_path := format('%s.layers[%s]', v_card_path, v_layer.ordinality - 1);
        v_front := NULLIF(BTRIM(v_layer.value->>'front'), '');
        v_back := NULLIF(BTRIM(v_layer.value->>'back'), '');
        IF v_front IS NULL OR v_back IS NULL THEN
          RAISE EXCEPTION 'E_EMPTY_CARD_SIDE|%: frente ou verso vazio.', v_layer_path;
        END IF;

        SELECT id INTO v_existing_card_id
        FROM public.flashcards
        WHERE list_id = _list_id
          AND deleted_at IS NULL
          AND lower(btrim(term)) = lower(v_front)
          AND lower(btrim(translation)) = lower(v_back)
        LIMIT 1;

        IF v_existing_card_id IS NOT NULL AND _card_conflict = 'error' THEN
          RAISE EXCEPTION 'E_DUPLICATE_CARD|%: card duplicado.', v_layer_path;
        ELSIF v_existing_card_id IS NOT NULL AND _card_conflict = 'skip' THEN
          v_cards_skipped := v_cards_skipped + 1;
          IF _batch_id IS NOT NULL THEN
            INSERT INTO public.global_import_items(
              batch_id, user_id, entity_type, entity_id, action, item_path
            ) VALUES (_batch_id, _uid, 'card', v_existing_card_id, 'skipped', v_layer_path);
          END IF;
        ELSE
          IF v_parent_card_id IS NULL THEN
            INSERT INTO public.flashcards(
              list_id, user_id, term, translation, context_tag
            ) VALUES (
              _list_id,
              _uid,
              BTRIM(v_card.value->>'group_title'),
              v_back,
              BTRIM(v_card.value->>'group_title')
            ) RETURNING id INTO v_parent_card_id;

            IF _batch_id IS NOT NULL THEN
              INSERT INTO public.global_import_items(
                batch_id, user_id, entity_type, entity_id, action, item_path
              ) VALUES (
                _batch_id, _uid, 'card', v_parent_card_id, 'created',
                v_card_path || '.$group'
              );
            END IF;
          END IF;

          v_word_hints := public.smart_word_hints_for_db_v2(v_layer.value->'word_hints');
          INSERT INTO public.flashcards(
            list_id, user_id, term, translation, hint, context_tag,
            example_text, example_translation, detailed_explanation,
            usage_notes, common_mistakes, short_explanation, word_hints,
            parent_card_id, layer_index, accepted_answers_en
          ) VALUES (
            _list_id, _uid, v_front, v_back,
            NULLIF(BTRIM(v_layer.value->>'hint'), ''),
            COALESCE(NULLIF(BTRIM(v_layer.value->>'context_tag'), ''), NULLIF(BTRIM(v_card.value->>'group_title'), '')),
            NULLIF(BTRIM(v_layer.value->>'example'), ''),
            NULLIF(BTRIM(v_layer.value->>'example_translation'), ''),
            NULLIF(BTRIM(v_layer.value->>'detailed_explanation'), ''),
            NULLIF(BTRIM(v_layer.value->>'usage_notes'), ''),
            NULLIF(BTRIM(v_layer.value->>'common_mistakes'), ''),
            NULLIF(BTRIM(v_layer.value->>'short_observation'), ''),
            v_word_hints,
            v_parent_card_id,
            v_layer.ordinality - 1,
            CASE WHEN NULLIF(BTRIM(v_layer.value->>'short_observation'), '') IS NULL
              THEN ARRAY[]::text[]
              ELSE ARRAY[BTRIM(v_layer.value->>'short_observation')] END
          ) RETURNING id INTO v_created_id;

          v_cards_created := v_cards_created + 1;
          v_layers_created := v_layers_created + 1;
          IF _batch_id IS NOT NULL THEN
            INSERT INTO public.global_import_items(
              batch_id, user_id, entity_type, entity_id, action, item_path
            ) VALUES (_batch_id, _uid, 'card', v_created_id, 'created', v_layer_path);
          END IF;
        END IF;
        v_existing_card_id := NULL;
      END LOOP;

      IF v_layers_created > 0 THEN
        v_groups_created := v_groups_created + 1;
      END IF;
    ELSE
      v_front := NULLIF(BTRIM(v_card.value->>'front'), '');
      v_back := NULLIF(BTRIM(v_card.value->>'back'), '');
      IF v_front IS NULL OR v_back IS NULL THEN
        RAISE EXCEPTION 'E_EMPTY_CARD_SIDE|%: frente ou verso vazio.', v_card_path;
      END IF;

      SELECT id INTO v_existing_card_id
      FROM public.flashcards
      WHERE list_id = _list_id
        AND deleted_at IS NULL
        AND lower(btrim(term)) = lower(v_front)
        AND lower(btrim(translation)) = lower(v_back)
      LIMIT 1;

      IF v_existing_card_id IS NOT NULL AND _card_conflict = 'error' THEN
        RAISE EXCEPTION 'E_DUPLICATE_CARD|%: card duplicado.', v_card_path;
      ELSIF v_existing_card_id IS NOT NULL AND _card_conflict = 'skip' THEN
        v_cards_skipped := v_cards_skipped + 1;
        IF _batch_id IS NOT NULL THEN
          INSERT INTO public.global_import_items(
            batch_id, user_id, entity_type, entity_id, action, item_path
          ) VALUES (_batch_id, _uid, 'card', v_existing_card_id, 'skipped', v_card_path);
        END IF;
      ELSE
        v_word_hints := public.smart_word_hints_for_db_v2(v_card.value->'word_hints');
        INSERT INTO public.flashcards(
          list_id, user_id, term, translation, hint, context_tag,
          example_text, example_translation, detailed_explanation,
          usage_notes, common_mistakes, short_explanation, word_hints,
          accepted_answers_en
        ) VALUES (
          _list_id, _uid, v_front, v_back,
          NULLIF(BTRIM(v_card.value->>'hint'), ''),
          NULLIF(BTRIM(v_card.value->>'context_tag'), ''),
          NULLIF(BTRIM(v_card.value->>'example'), ''),
          NULLIF(BTRIM(v_card.value->>'example_translation'), ''),
          NULLIF(BTRIM(v_card.value->>'detailed_explanation'), ''),
          NULLIF(BTRIM(v_card.value->>'usage_notes'), ''),
          NULLIF(BTRIM(v_card.value->>'common_mistakes'), ''),
          NULLIF(BTRIM(v_card.value->>'short_observation'), ''),
          v_word_hints,
          CASE WHEN NULLIF(BTRIM(v_card.value->>'short_observation'), '') IS NULL
            THEN ARRAY[]::text[]
            ELSE ARRAY[BTRIM(v_card.value->>'short_observation')] END
        ) RETURNING id INTO v_created_id;

        v_cards_created := v_cards_created + 1;
        IF _batch_id IS NOT NULL THEN
          INSERT INTO public.global_import_items(
            batch_id, user_id, entity_type, entity_id, action, item_path
          ) VALUES (_batch_id, _uid, 'card', v_created_id, 'created', v_card_path);
        END IF;
      END IF;
      v_existing_card_id := NULL;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'cards_created', v_cards_created,
    'cards_skipped', v_cards_skipped,
    'layered_groups_created', v_groups_created,
    'glossary_created', v_glossary_created,
    'glossary_updated', v_glossary_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.import_smart_list_v2(
  _list_id uuid,
  _payload jsonb,
  _duplicate_policy text DEFAULT 'skip'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN public.import_smart_list_content_v2(
    v_uid, _list_id, _payload, _duplicate_policy, NULL, '$'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_v2(
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
  v_uid uuid := auth.uid();
  v_batch_id uuid;
  v_existing public.global_import_batches%ROWTYPE;
  v_payload_hash text;
  v_package_name text;
  v_folder record;
  v_list record;
  v_folder_plan jsonb;
  v_list_plan jsonb;
  v_folder_id uuid;
  v_list_id uuid;
  v_folder_name text;
  v_list_name text;
  v_folder_path text;
  v_list_path text;
  v_next_order integer;
  v_list_report jsonb;
  v_folders_created integer := 0;
  v_folders_reused integer := 0;
  v_lists_created integer := 0;
  v_lists_reused integer := 0;
  v_lists_replaced integer := 0;
  v_lists_skipped integer := 0;
  v_cards_created integer := 0;
  v_cards_skipped integer := 0;
  v_groups_created integer := 0;
  v_glossary_created integer := 0;
  v_glossary_updated integer := 0;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL THEN
    RAISE EXCEPTION 'request_id é obrigatório.';
  END IF;
  IF _card_conflict NOT IN ('skip', 'copy', 'error') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object'
     OR _payload->>'schema' IS DISTINCT FROM 'app-piteco-super-import'
     OR _payload->>'version' IS DISTINCT FROM '2.0' THEN
    RAISE EXCEPTION 'E_SCHEMA|$: contrato app-piteco-super-import 2.0 inválido.';
  END IF;
  IF jsonb_typeof(_payload #> '{package,folders}') IS DISTINCT FROM 'array'
     OR jsonb_array_length(_payload #> '{package,folders}') = 0 THEN
    RAISE EXCEPTION 'E_SCHEMA|package.folders: array não vazio obrigatório.';
  END IF;
  IF jsonb_typeof(_destination_plan->'folders') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'E_CONFLICT|destination_plan: plano inválido.';
  END IF;
  IF _institution_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.institutions
    WHERE id = _institution_id AND owner_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Instituição inválida ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  v_package_name := NULLIF(BTRIM(_payload #>> '{package,name}'), '');
  IF v_package_name IS NULL THEN
    RAISE EXCEPTION 'E_EMPTY_NAME|package.name: nome obrigatório.';
  END IF;

  v_payload_hash := md5(
    _payload::text || '|' || _destination_plan::text || '|' ||
    _card_conflict || '|' || COALESCE(_institution_id::text, '')
  );

  SELECT * INTO v_existing
  FROM public.global_import_batches
  WHERE user_id = v_uid AND request_id = _request_id;

  IF FOUND THEN
    IF v_existing.payload_hash <> v_payload_hash THEN
      RAISE EXCEPTION 'request_id já usado com outro pacote.';
    END IF;
    IF v_existing.status = 'undone' THEN
      RAISE EXCEPTION 'Esta importação já foi desfeita. Inicie outra tentativa.';
    END IF;
    RETURN v_existing.summary || jsonb_build_object(
      'batch_id', v_existing.id,
      'request_id', v_existing.request_id,
      'status', v_existing.status
    );
  END IF;

  INSERT INTO public.global_import_batches(
    user_id, request_id, payload_hash, package_name,
    schema_version, status, options
  ) VALUES (
    v_uid, _request_id, v_payload_hash, v_package_name,
    2, 'processing',
    jsonb_build_object(
      'schema', 'app-piteco-super-import',
      'version', '2.0',
      'card_conflict', _card_conflict,
      'destination_plan', _destination_plan,
      'institution_id', _institution_id
    )
  ) RETURNING id INTO v_batch_id;

  FOR v_folder IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_payload #> '{package,folders}') WITH ORDINALITY
  LOOP
    v_folder_path := format('package.folders[%s]', v_folder.ordinality - 1);
    v_folder_plan := _destination_plan #> ARRAY['folders', (v_folder.ordinality - 1)::text];

    IF jsonb_typeof(v_folder_plan) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'E_CONFLICT|%: destino ausente.', v_folder_path;
    END IF;

    IF v_folder_plan #>> '{folder,mode}' = 'existing' THEN
      v_folder_id := (v_folder_plan #>> '{folder,folderId}')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.folders
        WHERE id = v_folder_id
          AND owner_id = v_uid
          AND deleted_at IS NULL
          AND class_id IS NULL
      ) THEN
        RAISE EXCEPTION 'E_CONFLICT|%: pasta inválida.', v_folder_path USING ERRCODE = '42501';
      END IF;
      v_folders_reused := v_folders_reused + 1;
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path
      ) VALUES (v_batch_id, v_uid, 'folder', v_folder_id, 'reused', v_folder_path);
    ELSIF v_folder_plan #>> '{folder,mode}' = 'create' THEN
      v_folder_name := COALESCE(
        NULLIF(BTRIM(v_folder_plan #>> '{folder,name}'), ''),
        NULLIF(BTRIM(v_folder.value->>'name'), '')
      );
      INSERT INTO public.folders(
        owner_id, title, description, visibility, institution_id,
        study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled
      ) VALUES (
        v_uid,
        v_folder_name,
        NULLIF(BTRIM(v_folder.value->>'description'), ''),
        'private',
        _institution_id,
        COALESCE(v_folder.value #>> '{lists,0,study_type}', 'language'),
        v_folder.value #>> '{lists,0,front_language}',
        v_folder.value #>> '{lists,0,back_language}',
        NULLIF(BTRIM(v_folder.value #>> '{lists,0,label_a}'), ''),
        NULLIF(BTRIM(v_folder.value #>> '{lists,0,label_b}'), ''),
        COALESCE((v_folder.value #>> '{lists,0,tts_enabled}')::boolean, true)
      ) RETURNING id INTO v_folder_id;
      v_folders_created := v_folders_created + 1;
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path
      ) VALUES (v_batch_id, v_uid, 'folder', v_folder_id, 'created', v_folder_path);
    ELSE
      RAISE EXCEPTION 'E_CONFLICT|%: modo de pasta inválido.', v_folder_path;
    END IF;

    SELECT COALESCE(MAX(order_index), -1) + 1 INTO v_next_order
    FROM public.lists
    WHERE folder_id = v_folder_id AND deleted_at IS NULL;

    FOR v_list IN
      SELECT value, ordinality
      FROM jsonb_array_elements(v_folder.value->'lists') WITH ORDINALITY
    LOOP
      v_list_path := format('%s.lists[%s]', v_folder_path, v_list.ordinality - 1);
      v_list_plan := v_folder_plan #> ARRAY['lists', (v_list.ordinality - 1)::text];

      IF jsonb_typeof(v_list_plan) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'E_CONFLICT|%: destino ausente.', v_list_path;
      END IF;

      IF v_list_plan->>'mode' = 'skip' THEN
        v_lists_skipped := v_lists_skipped + 1;
        INSERT INTO public.global_import_items(
          batch_id, user_id, entity_type, entity_id, action, item_path
        ) VALUES (v_batch_id, v_uid, 'list', NULL, 'skipped', v_list_path);
        CONTINUE;
      ELSIF v_list_plan->>'mode' = 'existing' THEN
        v_list_id := (v_list_plan->>'listId')::uuid;
        IF NOT EXISTS (
          SELECT 1 FROM public.lists
          WHERE id = v_list_id
            AND folder_id = v_folder_id
            AND owner_id = v_uid
            AND deleted_at IS NULL
        ) THEN
          RAISE EXCEPTION 'E_CONFLICT|%: lista inválida.', v_list_path USING ERRCODE = '42501';
        END IF;

        IF COALESCE(v_list_plan->>'strategy', 'append') = 'replace' THEN
          INSERT INTO public.global_import_items(
            batch_id, user_id, entity_type, entity_id, action, item_path, metadata
          )
          SELECT v_batch_id, v_uid, 'card', f.id, 'replaced', v_list_path, to_jsonb(f)
          FROM public.flashcards f
          WHERE f.list_id = v_list_id AND f.user_id = v_uid;

          INSERT INTO public.global_import_items(
            batch_id, user_id, entity_type, entity_id, action, item_path, metadata
          )
          SELECT v_batch_id, v_uid, 'glossary', g.id, 'replaced', v_list_path, to_jsonb(g)
          FROM public.list_glossary g
          WHERE g.list_id = v_list_id;

          DELETE FROM public.flashcards WHERE list_id = v_list_id AND user_id = v_uid;
          DELETE FROM public.list_glossary WHERE list_id = v_list_id;
          v_lists_replaced := v_lists_replaced + 1;
        ELSE
          v_lists_reused := v_lists_reused + 1;
        END IF;

        INSERT INTO public.global_import_items(
          batch_id, user_id, entity_type, entity_id, action, item_path, metadata
        )
        SELECT
          v_batch_id, v_uid, 'list', l.id,
          CASE WHEN COALESCE(v_list_plan->>'strategy', 'append') = 'replace'
            THEN 'replaced' ELSE 'reused' END,
          v_list_path,
          to_jsonb(l)
        FROM public.lists l
        WHERE l.id = v_list_id;
      ELSIF v_list_plan->>'mode' = 'create' THEN
        v_list_name := COALESCE(
          NULLIF(BTRIM(v_list_plan->>'name'), ''),
          NULLIF(BTRIM(v_list.value->>'name'), '')
        );
        INSERT INTO public.lists(
          folder_id, owner_id, title, description, order_index, visibility,
          institution_id, study_type, lang, lang_a, lang_b,
          labels_a, labels_b, tts_enabled
        ) VALUES (
          v_folder_id,
          v_uid,
          v_list_name,
          NULLIF(BTRIM(v_list.value->>'description'), ''),
          v_next_order,
          'private',
          _institution_id,
          COALESCE(NULLIF(BTRIM(v_list.value->>'study_type'), ''), 'language'),
          NULLIF(BTRIM(v_list.value->>'front_language'), ''),
          NULLIF(BTRIM(v_list.value->>'front_language'), ''),
          NULLIF(BTRIM(v_list.value->>'back_language'), ''),
          NULLIF(BTRIM(v_list.value->>'label_a'), ''),
          NULLIF(BTRIM(v_list.value->>'label_b'), ''),
          COALESCE((v_list.value->>'tts_enabled')::boolean, true)
        ) RETURNING id INTO v_list_id;
        v_next_order := v_next_order + 1;
        v_lists_created := v_lists_created + 1;
        INSERT INTO public.global_import_items(
          batch_id, user_id, entity_type, entity_id, action, item_path
        ) VALUES (v_batch_id, v_uid, 'list', v_list_id, 'created', v_list_path);
      ELSE
        RAISE EXCEPTION 'E_CONFLICT|%: modo de lista inválido.', v_list_path;
      END IF;

      v_list_report := public.import_smart_list_content_v2(
        v_uid, v_list_id, v_list.value, _card_conflict, v_batch_id, v_list_path
      );
      v_cards_created := v_cards_created + COALESCE((v_list_report->>'cards_created')::integer, 0);
      v_cards_skipped := v_cards_skipped + COALESCE((v_list_report->>'cards_skipped')::integer, 0);
      v_groups_created := v_groups_created + COALESCE((v_list_report->>'layered_groups_created')::integer, 0);
      v_glossary_created := v_glossary_created + COALESCE((v_list_report->>'glossary_created')::integer, 0);
      v_glossary_updated := v_glossary_updated + COALESCE((v_list_report->>'glossary_updated')::integer, 0);
    END LOOP;
  END LOOP;

  v_result := jsonb_build_object(
    'batch_id', v_batch_id,
    'request_id', _request_id,
    'status', 'completed',
    'package_name', v_package_name,
    'schema', 'app-piteco-super-import',
    'version', '2.0',
    'folders_created', v_folders_created,
    'folders_reused', v_folders_reused,
    'lists_created', v_lists_created,
    'lists_reused', v_lists_reused,
    'lists_replaced', v_lists_replaced,
    'lists_skipped', v_lists_skipped,
    'cards_created', v_cards_created,
    'cards_skipped', v_cards_skipped,
    'layered_groups_created', v_groups_created,
    'glossary_created', v_glossary_created,
    'glossary_updated', v_glossary_updated
  );

  UPDATE public.global_import_batches
  SET status = 'completed', summary = v_result, completed_at = now()
  WHERE id = v_batch_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_global_import_v1(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_batch public.global_import_batches%ROWTYPE;
  v_item record;
  v_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_batch
  FROM public.global_import_batches
  WHERE id = _batch_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Importação não encontrada.' USING ERRCODE = '42501';
  END IF;
  IF v_batch.status = 'undone' THEN
    RETURN;
  END IF;

  DELETE FROM public.list_glossary g
  USING public.global_import_items i
  WHERE i.batch_id = _batch_id
    AND i.user_id = v_uid
    AND i.entity_type = 'glossary'
    AND i.action = 'created'
    AND g.id = i.entity_id;

  DELETE FROM public.flashcards f
  USING public.global_import_items i
  WHERE i.batch_id = _batch_id
    AND i.user_id = v_uid
    AND i.entity_type = 'card'
    AND i.action = 'created'
    AND f.id = i.entity_id;

  FOR v_item IN
    SELECT * FROM public.global_import_items
    WHERE batch_id = _batch_id
      AND user_id = v_uid
      AND action = 'replaced'
      AND entity_type = 'glossary'
    ORDER BY id
  LOOP
    v_meta := v_item.metadata;
    INSERT INTO public.list_glossary(
      id, list_id, original_text, translated_text, note, side,
      is_active, created_at, updated_at
    ) VALUES (
      (v_meta->>'id')::uuid,
      (v_meta->>'list_id')::uuid,
      v_meta->>'original_text',
      v_meta->>'translated_text',
      v_meta->>'note',
      v_meta->>'side',
      COALESCE((v_meta->>'is_active')::boolean, true),
      COALESCE((v_meta->>'created_at')::timestamptz, now()),
      COALESCE((v_meta->>'updated_at')::timestamptz, now())
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR v_item IN
    SELECT * FROM public.global_import_items
    WHERE batch_id = _batch_id
      AND user_id = v_uid
      AND action = 'replaced'
      AND entity_type = 'card'
    ORDER BY ((metadata->>'parent_card_id') IS NOT NULL), id
  LOOP
    v_meta := v_item.metadata;
    INSERT INTO public.flashcards(
      id, collection_id, list_id, user_id, term, translation, hint,
      context_tag, example_text, example_translation, detailed_explanation,
      usage_notes, common_mistakes, short_explanation, audio_url,
      image_url_a, image_url_b, lang, display_text, eval_text, note_text,
      word_hints, accepted_answers_en, accepted_answers_pt, parent_card_id,
      layer_index, status_group_uid, deleted_at, created_at, updated_at
    ) VALUES (
      (v_meta->>'id')::uuid,
      NULLIF(v_meta->>'collection_id', '')::uuid,
      NULLIF(v_meta->>'list_id', '')::uuid,
      (v_meta->>'user_id')::uuid,
      v_meta->>'term',
      v_meta->>'translation',
      v_meta->>'hint',
      v_meta->>'context_tag',
      v_meta->>'example_text',
      v_meta->>'example_translation',
      v_meta->>'detailed_explanation',
      v_meta->>'usage_notes',
      v_meta->>'common_mistakes',
      v_meta->>'short_explanation',
      v_meta->>'audio_url',
      v_meta->>'image_url_a',
      v_meta->>'image_url_b',
      v_meta->>'lang',
      v_meta->>'display_text',
      v_meta->>'eval_text',
      CASE WHEN jsonb_typeof(v_meta->'note_text') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'note_text'))
        ELSE NULL END,
      v_meta->'word_hints',
      CASE WHEN jsonb_typeof(v_meta->'accepted_answers_en') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'accepted_answers_en'))
        ELSE NULL END,
      CASE WHEN jsonb_typeof(v_meta->'accepted_answers_pt') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'accepted_answers_pt'))
        ELSE NULL END,
      NULLIF(v_meta->>'parent_card_id', '')::uuid,
      NULLIF(v_meta->>'layer_index', '')::integer,
      NULLIF(v_meta->>'status_group_uid', '')::uuid,
      NULLIF(v_meta->>'deleted_at', '')::timestamptz,
      COALESCE((v_meta->>'created_at')::timestamptz, now()),
      COALESCE((v_meta->>'updated_at')::timestamptz, now())
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR v_item IN
    SELECT * FROM public.global_import_items
    WHERE batch_id = _batch_id
      AND user_id = v_uid
      AND action = 'updated'
      AND entity_type = 'glossary'
    ORDER BY id DESC
  LOOP
    v_meta := v_item.metadata;
    UPDATE public.list_glossary
    SET note = v_meta->>'note',
        is_active = COALESCE((v_meta->>'is_active')::boolean, true),
        updated_at = COALESCE((v_meta->>'updated_at')::timestamptz, now())
    WHERE id = (v_meta->>'id')::uuid;
  END LOOP;

  FOR v_item IN
    SELECT * FROM public.global_import_items
    WHERE batch_id = _batch_id
      AND user_id = v_uid
      AND entity_type = 'list'
      AND action IN ('reused', 'replaced')
      AND metadata IS NOT NULL
    ORDER BY id DESC
  LOOP
    v_meta := v_item.metadata;
    UPDATE public.lists
    SET title = v_meta->>'title',
        description = v_meta->>'description',
        order_index = COALESCE((v_meta->>'order_index')::integer, order_index),
        study_type = COALESCE(NULLIF(v_meta->>'study_type', ''), study_type),
        lang = v_meta->>'lang',
        lang_a = v_meta->>'lang_a',
        lang_b = v_meta->>'lang_b',
        labels_a = v_meta->>'labels_a',
        labels_b = v_meta->>'labels_b',
        tts_enabled = COALESCE((v_meta->>'tts_enabled')::boolean, tts_enabled),
        updated_at = COALESCE((v_meta->>'updated_at')::timestamptz, now())
    WHERE id = (v_meta->>'id')::uuid;
  END LOOP;

  DELETE FROM public.lists l
  USING public.global_import_items i
  WHERE i.batch_id = _batch_id
    AND i.user_id = v_uid
    AND i.entity_type = 'list'
    AND i.action = 'created'
    AND l.id = i.entity_id;

  DELETE FROM public.folders f
  USING public.global_import_items i
  WHERE i.batch_id = _batch_id
    AND i.user_id = v_uid
    AND i.entity_type = 'folder'
    AND i.action = 'created'
    AND f.id = i.entity_id;

  UPDATE public.global_import_batches
  SET status = 'undone', undone_at = now()
  WHERE id = _batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.smart_word_hints_for_db_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_smart_list_v2(uuid,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_v2(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_global_import_v1(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.smart_word_hints_for_db_v2(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_smart_list_v2(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_v2(uuid,jsonb,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v1(uuid) TO authenticated;

COMMIT;
