-- Restore the personal rich-import engine on environments that have the
-- legacy v1 importer and the atomic layered-card editor, but missed the
-- transactional v2 gateway migrations.
--
-- Safety properties:
--   * one transaction; any failure rolls back every catalog change;
--   * no DELETE, TRUNCATE, DROP TABLE, data rewrite, or project-ref change;
--   * short lock timeout to avoid interrupting active production traffic;
--   * prerequisites are checked before functions or constraints are changed.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_required_column_count integer;
BEGIN
  IF to_regclass('public.flashcards') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.flashcards');
  END IF;
  IF to_regclass('public.lists') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.lists');
  END IF;
  IF to_regclass('public.folders') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.folders');
  END IF;
  IF to_regclass('public.institutions') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.institutions');
  END IF;
  IF to_regclass('public.global_import_batches') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.global_import_batches');
  END IF;
  IF to_regclass('public.global_import_items') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.global_import_items');
  END IF;
  IF to_regclass('public.list_glossary') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.list_glossary');
  END IF;

  IF to_regprocedure('public.import_smart_list_content_v2_legacy(uuid,uuid,jsonb,text,uuid,text)') IS NULL
     AND to_regprocedure('public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'legacy smart-list import RPC');
  END IF;
  IF to_regprocedure('public.undo_global_import_v1(uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'RPC public.undo_global_import_v1(uuid)');
  END IF;
  IF to_regprocedure('public.save_layered_card_group_v2(uuid,uuid,text,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'atomic layered-card migration 20260712223000');
  END IF;

  IF to_regclass('public.flashcards') IS NOT NULL THEN
    SELECT count(*) INTO v_required_column_count
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'flashcards'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attname = ANY (ARRAY[
        'id', 'list_id', 'user_id', 'term', 'translation', 'hint',
        'context_tag', 'example_text', 'example_translation',
        'detailed_explanation', 'usage_notes', 'common_mistakes',
        'short_explanation', 'word_hints', 'accepted_answers_en',
        'parent_card_id', 'layer_index', 'deleted_at', 'created_at', 'updated_at'
      ]);

    IF v_required_column_count <> 20 THEN
      v_missing := array_append(v_missing, 'required enriched/layer identity columns on public.flashcards');
    END IF;
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION
      'E_IMPORT_ENGINE_PREFLIGHT|Migration aborted without changes. Missing prerequisites: %',
      array_to_string(v_missing, ', ');
  END IF;
END;
$preflight$;



-- recovery-section-1-complete

ALTER TABLE public.global_import_batches
  DROP CONSTRAINT IF EXISTS global_import_batches_schema_version_check;
ALTER TABLE public.global_import_batches
  ADD CONSTRAINT global_import_batches_schema_version_check
  CHECK (schema_version IN (1, 2)) NOT VALID;
ALTER TABLE public.global_import_batches
  VALIDATE CONSTRAINT global_import_batches_schema_version_check;

ALTER TABLE public.global_import_items
  ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.global_import_items
  DROP CONSTRAINT IF EXISTS global_import_items_entity_type_check;
ALTER TABLE public.global_import_items
  ADD CONSTRAINT global_import_items_entity_type_check
  CHECK (entity_type IN (
    'folder', 'list', 'card', 'glossary', 'assignment',
    'folder_glossary_snapshot'
  )) NOT VALID;
ALTER TABLE public.global_import_items
  VALIDATE CONSTRAINT global_import_items_entity_type_check;

ALTER TABLE public.global_import_items
  DROP CONSTRAINT IF EXISTS global_import_items_action_check;
ALTER TABLE public.global_import_items
  ADD CONSTRAINT global_import_items_action_check
  CHECK (action IN ('created', 'reused', 'skipped', 'updated', 'replaced')) NOT VALID;
ALTER TABLE public.global_import_items
  VALIDATE CONSTRAINT global_import_items_action_check;

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




-- recovery-section-2-complete

ALTER TABLE public.flashcards
  DROP CONSTRAINT IF EXISTS flashcards_layer_link_consistency;
ALTER TABLE public.flashcards
  ADD CONSTRAINT flashcards_layer_link_consistency
  CHECK (
    (parent_card_id IS NULL AND layer_index IS NULL)
    OR
    (parent_card_id IS NOT NULL AND layer_index IS NOT NULL AND layer_index >= 0)
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_unique_parent_layer
  ON public.flashcards(parent_card_id, layer_index)
  WHERE parent_card_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_flashcard_layer_link_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent public.flashcards%ROWTYPE;
BEGIN
  IF NEW.parent_card_id IS NULL THEN
    IF NEW.layer_index IS NOT NULL THEN
      RAISE EXCEPTION 'layer_index exige parent_card_id.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS NOT NULL AND NEW.parent_card_id = NEW.id THEN
    RAISE EXCEPTION 'Um flashcard não pode ser pai de si mesmo.';
  END IF;

  SELECT * INTO v_parent
  FROM public.flashcards
  WHERE id = NEW.parent_card_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card principal da camada não encontrado.';
  END IF;
  IF v_parent.parent_card_id IS NOT NULL THEN
    RAISE EXCEPTION 'Uma camada não pode ser usada como card principal.';
  END IF;
  IF v_parent.list_id IS DISTINCT FROM NEW.list_id THEN
    RAISE EXCEPTION 'Card principal e camada precisam pertencer à mesma lista.';
  END IF;
  IF v_parent.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Card principal e camada precisam pertencer ao mesmo usuário.';
  END IF;
  IF NEW.layer_index IS NULL OR NEW.layer_index < 0 THEN
    RAISE EXCEPTION 'Camada exige layer_index maior ou igual a zero.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_flashcard_layer_link_v1 ON public.flashcards;
CREATE TRIGGER trg_validate_flashcard_layer_link_v1
BEFORE INSERT OR UPDATE OF parent_card_id, layer_index, list_id, user_id
ON public.flashcards
FOR EACH ROW EXECUTE FUNCTION public.validate_flashcard_layer_link_v1();

DO $$
BEGIN
  IF to_regprocedure('public.import_smart_list_content_v2_legacy(uuid,uuid,jsonb,text,uuid,text)') IS NULL
     AND to_regprocedure('public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text)') IS NOT NULL THEN
    ALTER FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text)
      RENAME TO import_smart_list_content_v2_legacy;
  END IF;
END;
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
  v_base_report jsonb;
  v_normal_list jsonb;
  v_card record;
  v_layer record;
  v_card_path text;
  v_layer_path text;
  v_group_title text;
  v_parent_id uuid;
  v_existing_parent_id uuid;
  v_existing_child_id uuid;
  v_created_id uuid;
  v_front text;
  v_back text;
  v_word_hints jsonb;
  v_cards_created integer := 0;
  v_cards_skipped integer := 0;
  v_groups_created integer := 0;
BEGIN
  IF _card_conflict NOT IN ('skip', 'copy', 'error') THEN
    RAISE EXCEPTION 'Política de duplicata inválida para grupos em camadas.';
  END IF;

  v_normal_list := jsonb_set(
    _list,
    '{cards}',
    COALESCE((
      SELECT jsonb_agg(value ORDER BY ordinality)
      FROM jsonb_array_elements(COALESCE(_list->'cards', '[]'::jsonb)) WITH ORDINALITY
      WHERE COALESCE(value->>'type', 'normal') <> 'layered'
    ), '[]'::jsonb),
    true
  );

  v_base_report := public.import_smart_list_content_v2_legacy(
    _uid, _list_id, v_normal_list, _card_conflict, _batch_id, _list_path
  );

  FOR v_card IN
    SELECT value, ordinality
    FROM jsonb_array_elements(COALESCE(_list->'cards', '[]'::jsonb)) WITH ORDINALITY



-- recovery-section-3-complete

    WHERE COALESCE(value->>'type', 'normal') = 'layered'
  LOOP
    v_card_path := format('%s.cards[%s]', _list_path, v_card.ordinality - 1);
    v_group_title := NULLIF(BTRIM(v_card.value->>'group_title'), '');

    IF v_group_title IS NULL THEN
      RAISE EXCEPTION 'E_EMPTY_NAME|%: group_title obrigatório.', v_card_path;
    END IF;
    IF jsonb_typeof(v_card.value->'layers') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_card.value->'layers') < 2 THEN
      RAISE EXCEPTION 'E_SCHEMA|%: grupo layered exige ao menos duas camadas.', v_card_path;
    END IF;

    SELECT f.id INTO v_existing_parent_id
    FROM public.flashcards f
    WHERE f.list_id = _list_id
      AND f.user_id = _uid
      AND f.deleted_at IS NULL
      AND f.parent_card_id IS NULL
      AND lower(btrim(f.term)) = lower(v_group_title)
      AND EXISTS (
        SELECT 1 FROM public.flashcards child
        WHERE child.parent_card_id = f.id AND child.deleted_at IS NULL
      )
    ORDER BY f.created_at
    LIMIT 1;

    IF v_existing_parent_id IS NOT NULL AND _card_conflict = 'error' THEN
      RAISE EXCEPTION 'E_DUPLICATE_CARD|%: grupo em camadas duplicado.', v_card_path;
    END IF;

    IF v_existing_parent_id IS NOT NULL AND _card_conflict = 'skip' THEN
      FOR v_layer IN
        SELECT value, ordinality
        FROM jsonb_array_elements(v_card.value->'layers') WITH ORDINALITY
      LOOP
        v_layer_path := format('%s.layers[%s]', v_card_path, v_layer.ordinality - 1);
        SELECT id INTO v_existing_child_id
        FROM public.flashcards
        WHERE parent_card_id = v_existing_parent_id
          AND deleted_at IS NULL
          AND layer_index = v_layer.ordinality - 1
        LIMIT 1;

        v_cards_skipped := v_cards_skipped + 1;
        IF _batch_id IS NOT NULL THEN
          INSERT INTO public.global_import_items(
            batch_id, user_id, entity_type, entity_id, action, item_path
          ) VALUES (
            _batch_id, _uid, 'card', COALESCE(v_existing_child_id, v_existing_parent_id),
            'skipped', v_layer_path
          );
        END IF;
      END LOOP;
      v_existing_parent_id := NULL;
      CONTINUE;
    END IF;

    INSERT INTO public.flashcards(
      list_id, user_id, term, translation, context_tag
    ) VALUES (
      _list_id, _uid, v_group_title,
      BTRIM(v_card.value->'layers'->0->>'back'),
      v_group_title
    ) RETURNING id INTO v_parent_id;

    IF _batch_id IS NOT NULL THEN
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path
      ) VALUES (
        _batch_id, _uid, 'card', v_parent_id, 'created', v_card_path || '.$group'
      );
    END IF;

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

      v_word_hints := public.smart_word_hints_for_db_v2(v_layer.value->'word_hints');
      INSERT INTO public.flashcards(
        list_id, user_id, term, translation, hint, context_tag,
        example_text, example_translation, detailed_explanation,
        usage_notes, common_mistakes, short_explanation, word_hints,
        parent_card_id, layer_index, accepted_answers_en
      ) VALUES (
        _list_id, _uid, v_front, v_back,
        NULLIF(BTRIM(v_layer.value->>'hint'), ''),
        COALESCE(NULLIF(BTRIM(v_layer.value->>'context_tag'), ''), v_group_title),
        NULLIF(BTRIM(v_layer.value->>'example'), ''),
        NULLIF(BTRIM(v_layer.value->>'example_translation'), ''),
        NULLIF(BTRIM(v_layer.value->>'detailed_explanation'), ''),
        NULLIF(BTRIM(v_layer.value->>'usage_notes'), ''),
        NULLIF(BTRIM(v_layer.value->>'common_mistakes'), ''),
        NULLIF(BTRIM(v_layer.value->>'short_observation'), ''),
        v_word_hints,
        v_parent_id,
        v_layer.ordinality - 1,
        CASE WHEN NULLIF(BTRIM(v_layer.value->>'short_observation'), '') IS NULL
          THEN ARRAY[]::text[]
          ELSE ARRAY[BTRIM(v_layer.value->>'short_observation')] END
      ) RETURNING id INTO v_created_id;

      v_cards_created := v_cards_created + 1;
      IF _batch_id IS NOT NULL THEN
        INSERT INTO public.global_import_items(
          batch_id, user_id, entity_type, entity_id, action, item_path
        ) VALUES (_batch_id, _uid, 'card', v_created_id, 'created', v_layer_path);
      END IF;
    END LOOP;

    v_groups_created := v_groups_created + 1;
    v_parent_id := NULL;
    v_existing_parent_id := NULL;
  END LOOP;

  RETURN v_base_report || jsonb_build_object(
    'cards_created', COALESCE((v_base_report->>'cards_created')::integer, 0) + v_cards_created,
    'cards_skipped', COALESCE((v_base_report->>'cards_skipped')::integer, 0) + v_cards_skipped,
    'layered_groups_created', COALESCE((v_base_report->>'layered_groups_created')::integer, 0) + v_groups_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) TO authenticated;



-- recovery-section-4-complete

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



-- recovery-section-5-complete

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




-- recovery-section-6-complete

CREATE OR REPLACE FUNCTION public.replace_super_import_skipped_card_v1(
  _batch_id uuid,
  _item_path text,
  _card jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_card_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT i.entity_id
  INTO v_card_id
  FROM public.global_import_items i
  WHERE i.batch_id = _batch_id
    AND i.user_id = v_uid
    AND i.entity_type = 'card'
    AND i.action = 'skipped'
    AND i.item_path = _item_path
    AND i.entity_id IS NOT NULL
  ORDER BY i.id DESC
  LIMIT 1;

  IF v_card_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.global_import_items i
    WHERE i.batch_id = _batch_id
      AND i.user_id = v_uid
      AND i.entity_type = 'card'
      AND i.action = 'updated'
      AND i.item_path = _item_path || '.$replace'
  ) THEN
    INSERT INTO public.global_import_items(
      batch_id, user_id, entity_type, entity_id, action, item_path, metadata
    )
    SELECT
      _batch_id, v_uid, 'card', f.id, 'updated',
      _item_path || '.$replace', to_jsonb(f)
    FROM public.flashcards f
    WHERE f.id = v_card_id
      AND f.user_id = v_uid;
  END IF;

  UPDATE public.flashcards
  SET term = BTRIM(_card->>'front'),
      translation = BTRIM(_card->>'back'),
      hint = NULLIF(BTRIM(_card->>'hint'), ''),
      context_tag = NULLIF(BTRIM(_card->>'context_tag'), ''),
      example_text = NULLIF(BTRIM(_card->>'example'), ''),
      example_translation = NULLIF(BTRIM(_card->>'example_translation'), ''),
      detailed_explanation = NULLIF(BTRIM(_card->>'detailed_explanation'), ''),
      usage_notes = NULLIF(BTRIM(_card->>'usage_notes'), ''),
      common_mistakes = NULLIF(BTRIM(_card->>'common_mistakes'), ''),
      short_explanation = NULLIF(BTRIM(_card->>'short_observation'), ''),
      word_hints = public.smart_word_hints_for_db_v2(_card->'word_hints'),
      accepted_answers_en = CASE
        WHEN NULLIF(BTRIM(_card->>'short_observation'), '') IS NULL
          THEN ARRAY[]::text[]
        ELSE ARRAY[BTRIM(_card->>'short_observation')]
      END,
      updated_at = now()
  WHERE id = v_card_id
    AND user_id = v_uid;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_super_import_duplicate_replacements_v1(
  _batch_id uuid,
  _payload jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_folder record;
  v_list record;
  v_card record;
  v_layer record;
  v_card_path text;
  v_layer_path text;
  v_updated integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.global_import_batches b
    WHERE b.id = _batch_id AND b.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Lote de importação inválido.' USING ERRCODE = '42501';
  END IF;

  FOR v_folder IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_payload #> '{package,folders}') WITH ORDINALITY
  LOOP
    FOR v_list IN
      SELECT value, ordinality
      FROM jsonb_array_elements(v_folder.value->'lists') WITH ORDINALITY
    LOOP
      FOR v_card IN
        SELECT value, ordinality
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(v_list.value->'cards') = 'array'
            THEN v_list.value->'cards' ELSE '[]'::jsonb END
        ) WITH ORDINALITY
      LOOP
        v_card_path := format(
          'package.folders[%s].lists[%s].cards[%s]',
          v_folder.ordinality - 1,
          v_list.ordinality - 1,
          v_card.ordinality - 1
        );

        IF COALESCE(v_card.value->>'type', 'normal') = 'layered' THEN
          FOR v_layer IN
            SELECT value, ordinality
            FROM jsonb_array_elements(v_card.value->'layers') WITH ORDINALITY
          LOOP
            v_layer_path := format('%s.layers[%s]', v_card_path, v_layer.ordinality - 1);
            IF public.replace_super_import_skipped_card_v1(
              _batch_id, v_layer_path, v_layer.value
            ) THEN
              v_updated := v_updated + 1;
            END IF;
          END LOOP;
        ELSE
          IF public.replace_super_import_skipped_card_v1(
            _batch_id, v_card_path, v_card.value
          ) THEN
            v_updated := v_updated + 1;
          END IF;
        END IF;
      END LOOP;
    END LOOP;



-- recovery-section-7-complete

  END LOOP;

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_v3(
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
  v_existing public.global_import_batches%ROWTYPE;
  v_report jsonb;
  v_updated integer := 0;
  v_remaining_skipped integer := 0;
BEGIN
  IF _card_conflict NOT IN ('skip', 'copy', 'error', 'replace') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;

  IF _card_conflict <> 'replace' THEN
    RETURN public.import_app_piteco_super_package_v2(
      _request_id, _payload, _destination_plan, _card_conflict, _institution_id
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.global_import_batches
  WHERE user_id = v_uid AND request_id = _request_id;

  IF FOUND THEN
    IF v_existing.options->>'requested_card_conflict' = 'replace' THEN
      RETURN v_existing.summary || jsonb_build_object(
        'batch_id', v_existing.id,
        'request_id', v_existing.request_id,
        'status', v_existing.status
      );
    END IF;
    RAISE EXCEPTION 'request_id já usado com outra política de duplicata.';
  END IF;

  v_report := public.import_app_piteco_super_package_v2(
    _request_id, _payload, _destination_plan, 'skip', _institution_id
  );

  v_updated := public.apply_super_import_duplicate_replacements_v1(
    (v_report->>'batch_id')::uuid,
    _payload
  );
  v_remaining_skipped := GREATEST(
    COALESCE((v_report->>'cards_skipped')::integer, 0) - v_updated,
    0
  );
  v_report := v_report || jsonb_build_object(
    'cards_updated', v_updated,
    'cards_skipped', v_remaining_skipped
  );

  UPDATE public.global_import_batches
  SET summary = v_report,
      options = COALESCE(options, '{}'::jsonb) || jsonb_build_object(
        'card_conflict', 'replace',
        'requested_card_conflict', 'replace'
      )
  WHERE id = (v_report->>'batch_id')::uuid
    AND user_id = v_uid;

  RETURN v_report;
END;
$$;




-- recovery-section-8-complete

CREATE OR REPLACE FUNCTION public.restore_super_import_updated_cards_v1(
  _batch_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item record;
  v_meta jsonb;
  v_restored integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.global_import_batches b
    WHERE b.id = _batch_id AND b.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Importação não encontrada.' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN
    SELECT *
    FROM public.global_import_items
    WHERE batch_id = _batch_id
      AND user_id = v_uid
      AND entity_type = 'card'
      AND action = 'updated'
    ORDER BY id DESC
  LOOP
    v_meta := v_item.metadata;
    UPDATE public.flashcards
    SET term = v_meta->>'term',
        translation = v_meta->>'translation',
        hint = v_meta->>'hint',
        context_tag = v_meta->>'context_tag',
        example_text = v_meta->>'example_text',
        example_translation = v_meta->>'example_translation',
        detailed_explanation = v_meta->>'detailed_explanation',
        usage_notes = v_meta->>'usage_notes',
        common_mistakes = v_meta->>'common_mistakes',
        short_explanation = v_meta->>'short_explanation',
        audio_url = v_meta->>'audio_url',
        image_url_a = v_meta->>'image_url_a',
        image_url_b = v_meta->>'image_url_b',
        lang = v_meta->>'lang',
        display_text = v_meta->>'display_text',
        eval_text = v_meta->>'eval_text',
        note_text = CASE WHEN jsonb_typeof(v_meta->'note_text') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'note_text'))
          ELSE NULL END,
        word_hints = v_meta->'word_hints',
        accepted_answers_en = CASE WHEN jsonb_typeof(v_meta->'accepted_answers_en') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'accepted_answers_en'))
          ELSE NULL END,
        accepted_answers_pt = CASE WHEN jsonb_typeof(v_meta->'accepted_answers_pt') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'accepted_answers_pt'))
          ELSE NULL END,
        parent_card_id = NULLIF(v_meta->>'parent_card_id', '')::uuid,
        layer_index = NULLIF(v_meta->>'layer_index', '')::integer,
        status_group_uid = NULLIF(v_meta->>'status_group_uid', '')::uuid,
        deleted_at = NULLIF(v_meta->>'deleted_at', '')::timestamptz,
        updated_at = COALESCE(NULLIF(v_meta->>'updated_at', '')::timestamptz, now())
    WHERE id = v_item.entity_id
      AND user_id = v_uid;

    IF FOUND THEN v_restored := v_restored + 1; END IF;
  END LOOP;

  RETURN v_restored;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_global_import_v2(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.restore_super_import_updated_cards_v1(_batch_id);
  PERFORM public.undo_global_import_v1(_batch_id);
END;
$$;




-- recovery-section-9-complete

CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_current(
  _request_id uuid,
  _payload jsonb,
  _destination_plan jsonb,
  _card_conflict text DEFAULT 'skip',
  _institution_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF _card_conflict = 'replace' AND jsonb_path_exists(
    _payload,
    '$.package.folders[*].lists[*].cards[*] ? (@.type == "layered")'
  ) THEN
    RAISE EXCEPTION 'E_LAYERED_REPLACE_UNSUPPORTED|Use skip, copy ou error para pacotes com camadas.';
  END IF;

  RETURN public.import_app_piteco_super_package_v3(
    _request_id, _payload, _destination_plan, _card_conflict, _institution_id
  );
END;
$$;




-- recovery-section-10-complete

CREATE OR REPLACE FUNCTION public.get_import_capabilities_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_authenticated boolean := auth.uid() IS NOT NULL;
  v_gateway_present boolean := to_regprocedure('public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid)') IS NOT NULL;
  v_classroom_gateway_present boolean := to_regprocedure('public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text)') IS NOT NULL;
  v_undo_present boolean := to_regprocedure('public.undo_global_import_v2(uuid)') IS NOT NULL;
  v_classroom_undo_present boolean := to_regprocedure('public.undo_classroom_global_import_v2(uuid)') IS NOT NULL;
  v_glossary_present boolean := to_regprocedure('public.sync_folder_glossaries_from_super_import_v1(uuid,jsonb)') IS NOT NULL;
  v_layer_rpc_present boolean := to_regprocedure('public.save_layered_card_group_v2(uuid,uuid,text,jsonb)') IS NOT NULL;
  v_gateway_granted boolean := false;
  v_classroom_gateway_granted boolean := false;
  v_undo_granted boolean := false;
  v_classroom_undo_granted boolean := false;
  v_glossary_granted boolean := false;
  v_layer_rpc_granted boolean := false;
  v_flashcards_schema boolean := false;
  v_import_schema boolean := false;
  v_enriched_schema boolean := false;
  v_layer_schema boolean := false;
  v_flashcards_rls boolean := false;
  v_import_batches_rls boolean := false;
  v_import_items_rls boolean := false;
  v_basic_import boolean := false;
  v_safe_import boolean := false;
  v_enriched_fields boolean := false;
  v_layered_cards boolean := false;
  v_engine_version text := 'unknown';
  v_migration_revision text := null;
  v_checks jsonb := '[]'::jsonb;
  v_status text;
BEGIN
  IF v_gateway_present THEN
    v_gateway_granted := has_function_privilege(
      current_user,
      'public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_classroom_gateway_present THEN
    v_classroom_gateway_granted := has_function_privilege(
      current_user,
      'public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_undo_present THEN
    v_undo_granted := has_function_privilege(
      current_user,
      'public.undo_global_import_v2(uuid)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_classroom_undo_present THEN
    v_classroom_undo_granted := has_function_privilege(
      current_user,
      'public.undo_classroom_global_import_v2(uuid)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_glossary_present THEN
    v_glossary_granted := has_function_privilege(
      current_user,
      'public.sync_folder_glossaries_from_super_import_v1(uuid,jsonb)'::regprocedure,
      'EXECUTE'
    );
  END IF;
  IF v_layer_rpc_present THEN
    v_layer_rpc_granted := has_function_privilege(
      current_user,
      'public.save_layered_card_group_v2(uuid,uuid,text,jsonb)'::regprocedure,
      'EXECUTE'
    );
  END IF;

  SELECT to_regclass('public.flashcards') IS NOT NULL
    AND to_regclass('public.lists') IS NOT NULL
    AND to_regclass('public.folders') IS NOT NULL
  INTO v_flashcards_schema;

  SELECT to_regclass('public.global_import_batches') IS NOT NULL
    AND to_regclass('public.global_import_items') IS NOT NULL
  INTO v_import_schema;

  SELECT count(*) = 10
  INTO v_enriched_schema
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'flashcards'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname = ANY (ARRAY[
      'context_tag', 'example_text', 'example_translation', 'detailed_explanation',
      'usage_notes', 'common_mistakes', 'short_explanation', 'word_hints',
      'parent_card_id', 'layer_index'
  ]);

  SELECT count(*) = 2
  INTO v_layer_schema
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'flashcards'
    AND a.attnum > 0
    AND NOT a.attisdropped
  AND a.attname = ANY (ARRAY['parent_card_id', 'layer_index']);

  SELECT COALESCE(bool_and(c.relrowsecurity), false)
  INTO v_flashcards_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'flashcards';



-- recovery-section-11-complete


  SELECT COALESCE(bool_and(c.relrowsecurity), false)
  INTO v_import_batches_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'global_import_batches';

  SELECT COALESCE(bool_and(c.relrowsecurity), false)
  INTO v_import_items_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'global_import_items';

  v_basic_import := v_authenticated AND v_gateway_present AND v_gateway_granted AND v_flashcards_schema;
  v_safe_import := v_basic_import
    AND v_import_schema
    AND v_import_batches_rls
    AND v_import_items_rls
    AND v_undo_present
    AND v_undo_granted;
  v_enriched_fields := v_safe_import AND v_enriched_schema;
  v_layered_cards := v_enriched_fields
    AND v_layer_schema
    AND v_layer_rpc_present
    AND v_layer_rpc_granted;

  IF v_layered_cards THEN
    v_engine_version := '2.0';
    v_migration_revision := '20260729175633';
  ELSIF v_enriched_fields THEN
    v_engine_version := '2.0-rich-import';
  ELSIF v_safe_import THEN
    v_engine_version := '1.0-safe-import';
  END IF;

  v_status := CASE WHEN v_authenticated THEN 'ready' ELSE 'missing' END;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'auth', 'code', 'auth', 'status', v_status, 'required', true,
    'detail', CASE WHEN v_authenticated THEN 'Sessão autenticada disponível.' ELSE 'Sessão ausente ou expirada.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'personal_gateway', 'code', CASE WHEN v_gateway_present THEN 'grant' ELSE 'rpc' END,
    'status', CASE WHEN NOT v_gateway_present THEN 'missing' WHEN NOT v_gateway_granted THEN 'missing' ELSE 'ready' END,
    'required', true, 'detail', CASE WHEN NOT v_gateway_present THEN 'Gateway transacional pessoal ausente.' WHEN NOT v_gateway_granted THEN 'Sessão sem EXECUTE no gateway pessoal.' ELSE 'Gateway transacional pessoal disponível.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'classroom_gateway', 'code', CASE WHEN v_classroom_gateway_present THEN 'grant' ELSE 'rpc' END,
    'status', CASE WHEN NOT v_classroom_gateway_present THEN 'missing' WHEN NOT v_classroom_gateway_granted THEN 'missing' ELSE 'ready' END,
    'required', false, 'detail', CASE WHEN NOT v_classroom_gateway_present THEN 'Gateway transacional de turma ausente.' WHEN NOT v_classroom_gateway_granted THEN 'Sessão sem EXECUTE no gateway de turma.' ELSE 'Gateway transacional de turma disponível.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'import_schema', 'code', 'schema',
    'status', CASE WHEN v_import_schema THEN 'ready' ELSE 'missing' END,
    'required', true, 'detail', CASE WHEN v_import_schema THEN 'Estruturas de lote presentes.' ELSE 'Estruturas global_import ausentes.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'enriched_schema', 'code', 'schema',
    'status', CASE WHEN v_enriched_schema THEN 'ready' ELSE 'missing' END,
    'required', false, 'detail', CASE WHEN v_enriched_schema THEN 'Colunas enriquecidas presentes.' ELSE 'Uma ou mais colunas enriquecidas estão ausentes.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'layered_migration', 'code', CASE WHEN v_layer_rpc_present THEN 'grant' ELSE 'migration' END,
    'status', CASE WHEN NOT v_layer_rpc_present THEN 'missing' WHEN NOT v_layer_rpc_granted THEN 'missing' WHEN NOT v_layer_schema THEN 'missing' ELSE 'ready' END,
    'required', false, 'detail', CASE WHEN NOT v_layer_rpc_present THEN 'Migration 20260712223000 não aplicada: RPC atômico de camadas ausente.' WHEN NOT v_layer_rpc_granted THEN 'RPC atômico de camadas sem EXECUTE para a sessão.' WHEN NOT v_layer_schema THEN 'Colunas de identidade de camada ausentes.' ELSE 'Migration atômica de camadas disponível.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'undo', 'code', CASE WHEN v_undo_present THEN 'grant' ELSE 'rpc' END,
    'status', CASE WHEN NOT v_undo_present THEN 'missing' WHEN NOT v_undo_granted THEN 'missing' ELSE 'ready' END,
    'required', true, 'detail', CASE WHEN NOT v_undo_present THEN 'Função de desfazer ausente.' WHEN NOT v_undo_granted THEN 'Sessão sem EXECUTE na função de desfazer.' ELSE 'Desfazer por lote disponível.' END
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key', 'rls', 'code', 'schema',
    'status', CASE WHEN v_flashcards_rls AND v_import_batches_rls AND v_import_items_rls THEN 'ready' ELSE 'missing' END,
    'required', true, 'detail', CASE WHEN v_flashcards_rls AND v_import_batches_rls AND v_import_items_rls THEN 'RLS habilitado nas tabelas de importação.' ELSE 'RLS ausente em uma tabela de importação.' END
  ));

  RETURN jsonb_build_object(
    'contract_version', '1',
    'engine_version', v_engine_version,
    'migration_revision', v_migration_revision,
    'project_ref', null,
    'environment', 'supabase-database',
    'database_name', current_database(),
    'server_version', current_setting('server_version'),
    'capabilities', jsonb_build_object(
      'safe_import', v_safe_import,
      'layered_cards', v_layered_cards,
      'enriched_fields', v_enriched_fields,
      'basic_import', v_basic_import
    ),
    'checks', v_checks,
    'diagnostic_codes', CASE
      WHEN v_layered_cards THEN jsonb_build_array('ready')
      WHEN NOT v_authenticated THEN jsonb_build_array('auth')
      WHEN NOT v_gateway_present OR NOT v_gateway_granted THEN jsonb_build_array(CASE WHEN v_gateway_present THEN 'grant' ELSE 'rpc' END)
      WHEN NOT v_import_schema OR NOT v_import_batches_rls OR NOT v_import_items_rls THEN jsonb_build_array('schema')
      WHEN NOT v_layer_rpc_present THEN jsonb_build_array('migration')
      WHEN NOT v_layer_rpc_granted THEN jsonb_build_array('grant')
      ELSE jsonb_build_array('unknown')
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_import_capabilities_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_import_capabilities_v1() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_import_capabilities_v1() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Helper functions are intentionally private. Only authenticated gateways and
-- undo operations are callable by clients.
ALTER FUNCTION public.import_smart_list_content_v2_legacy(uuid,uuid,jsonb,text,uuid,text)
  SECURITY DEFINER;
ALTER FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text)
  SECURITY DEFINER;
ALTER FUNCTION public.import_app_piteco_super_package_v2(uuid,jsonb,jsonb,text,uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.undo_global_import_v2(uuid)
  SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.smart_word_hints_for_db_v2(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_smart_list_content_v2_legacy(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_v2(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_super_import_skipped_card_v1(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_super_import_duplicate_replacements_v1(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_super_import_updated_cards_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_global_import_v2(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_import_capabilities_v1() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_import_capabilities_v1() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
