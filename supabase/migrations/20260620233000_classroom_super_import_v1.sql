-- App Piteco — Super Importador contextual para turmas
-- Reutiliza o motor enriquecido de cards/glossário/camadas e adiciona
-- destino de turma, atribuição automática, idempotência e desfazer por lote.

BEGIN;

ALTER TABLE public.global_import_items
  DROP CONSTRAINT IF EXISTS global_import_items_entity_type_check;
ALTER TABLE public.global_import_items
  ADD CONSTRAINT global_import_items_entity_type_check
  CHECK (entity_type IN ('folder', 'list', 'card', 'glossary', 'assignment'));

CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_to_class_v1(
  _request_id uuid,
  _payload jsonb,
  _destination_plan jsonb,
  _turma_id uuid,
  _card_conflict text DEFAULT 'skip'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher_id uuid;
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
  v_assignment_id uuid;
  v_folder_name text;
  v_list_name text;
  v_folder_path text;
  v_list_path text;
  v_next_order integer;
  v_next_assignment_order integer;
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
  v_assignments_created integer := 0;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL THEN
    RAISE EXCEPTION 'request_id é obrigatório.';
  END IF;
  IF _turma_id IS NULL THEN
    RAISE EXCEPTION 'turma_id é obrigatório.';
  END IF;
  IF _card_conflict NOT IN ('skip', 'copy', 'error') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;

  SELECT t.owner_teacher_id
  INTO v_teacher_id
  FROM public.turmas t
  WHERE t.id = _turma_id
    AND t.ativo = true;

  IF v_teacher_id IS NULL OR v_teacher_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Turma inválida ou sem permissão.' USING ERRCODE = '42501';
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

  v_package_name := NULLIF(BTRIM(_payload #>> '{package,name}'), '');
  IF v_package_name IS NULL THEN
    RAISE EXCEPTION 'E_EMPTY_NAME|package.name: nome obrigatório.';
  END IF;

  v_payload_hash := md5(
    _payload::text || '|' || _destination_plan::text || '|' ||
    _card_conflict || '|classroom|' || _turma_id::text
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
      'target_scope', 'classroom',
      'turma_id', _turma_id
    )
  ) RETURNING id INTO v_batch_id;

  SELECT COALESCE(MAX(a.order_index), 0) + 1
  INTO v_next_assignment_order
  FROM public.atribuicoes a
  WHERE a.turma_id = _turma_id;

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
      SELECT f.title INTO v_folder_name
      FROM public.folders f
      WHERE f.id = v_folder_id
        AND f.owner_id = v_uid
        AND f.class_id = _turma_id
        AND f.deleted_at IS NULL;

      IF v_folder_name IS NULL THEN
        RAISE EXCEPTION 'E_CONFLICT|%: pasta da turma inválida.', v_folder_path USING ERRCODE = '42501';
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
      IF v_folder_name IS NULL THEN
        RAISE EXCEPTION 'E_EMPTY_NAME|%: nome da pasta obrigatório.', v_folder_path;
      END IF;

      INSERT INTO public.folders(
        owner_id, title, description, visibility, class_id,
        study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled
      ) VALUES (
        v_uid,
        v_folder_name,
        NULLIF(BTRIM(v_folder.value->>'description'), ''),
        'class',
        _turma_id,
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

    SELECT a.id INTO v_assignment_id
    FROM public.atribuicoes a
    WHERE a.turma_id = _turma_id
      AND a.fonte_tipo::text = 'pasta'
      AND a.fonte_id = v_folder_id
    LIMIT 1;

    IF v_assignment_id IS NULL THEN
      INSERT INTO public.atribuicoes(
        turma_id, titulo, descricao, fonte_tipo, fonte_id, order_index
      ) VALUES (
        _turma_id,
        v_folder_name,
        NULLIF(BTRIM(v_folder.value->>'description'), ''),
        'pasta'::public.atribuicao_fonte_tipo,
        v_folder_id,
        v_next_assignment_order
      ) RETURNING id INTO v_assignment_id;

      v_next_assignment_order := v_next_assignment_order + 1;
      v_assignments_created := v_assignments_created + 1;
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path
      ) VALUES (
        v_batch_id, v_uid, 'assignment', v_assignment_id, 'created',
        v_folder_path || '.$assignment'
      );
    ELSE
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path
      ) VALUES (
        v_batch_id, v_uid, 'assignment', v_assignment_id, 'reused',
        v_folder_path || '.$assignment'
      );
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
            AND class_id = _turma_id
            AND deleted_at IS NULL
        ) THEN
          RAISE EXCEPTION 'E_CONFLICT|%: lista da turma inválida.', v_list_path USING ERRCODE = '42501';
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
        IF v_list_name IS NULL THEN
          RAISE EXCEPTION 'E_EMPTY_NAME|%: nome da lista obrigatório.', v_list_path;
        END IF;

        INSERT INTO public.lists(
          folder_id, owner_id, title, description, order_index, visibility,
          class_id, study_type, lang, lang_a, lang_b,
          labels_a, labels_b, tts_enabled
        ) VALUES (
          v_folder_id,
          v_uid,
          v_list_name,
          NULLIF(BTRIM(v_list.value->>'description'), ''),
          v_next_order,
          'class',
          _turma_id,
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
    'target_scope', 'classroom',
    'turma_id', _turma_id,
    'assignments_created', v_assignments_created,
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

CREATE OR REPLACE FUNCTION public.undo_classroom_global_import_v1(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_batch public.global_import_batches%ROWTYPE;
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
  IF v_batch.options->>'target_scope' IS DISTINCT FROM 'classroom' THEN
    RAISE EXCEPTION 'Este lote não pertence a uma turma.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.atribuicoes a
  USING public.global_import_items i
  WHERE i.batch_id = _batch_id
    AND i.user_id = v_uid
    AND i.entity_type = 'assignment'
    AND i.action = 'created'
    AND a.id = i.entity_id;

  PERFORM public.undo_global_import_v1(_batch_id);
END;
$$;

REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_to_class_v1(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_classroom_global_import_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_to_class_v1(uuid,jsonb,jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_classroom_global_import_v1(uuid) TO authenticated;

COMMIT;
