-- App Piteco — integridade e importação transacional de grupos em camadas

BEGIN;

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS smart_key text,
  ADD COLUMN IF NOT EXISTS is_layer_group boolean NOT NULL DEFAULT false;

UPDATE public.flashcards parent
SET is_layer_group = true
WHERE parent.parent_card_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.flashcards child
    WHERE child.parent_card_id = parent.id
  );

UPDATE public.flashcards
SET layer_index = NULL
WHERE parent_card_id IS NULL
  AND layer_index IS NOT NULL;

WITH ordered AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY parent_card_id
      ORDER BY layer_index NULLS LAST, created_at, id
    ) - 1 AS next_index
  FROM public.flashcards
  WHERE parent_card_id IS NOT NULL
)
UPDATE public.flashcards card
SET layer_index = ordered.next_index
FROM ordered
WHERE card.id = ordered.id;

ALTER TABLE public.flashcards
  DROP CONSTRAINT IF EXISTS flashcards_layer_linkage_check;
ALTER TABLE public.flashcards
  ADD CONSTRAINT flashcards_layer_linkage_check
  CHECK (
    (parent_card_id IS NULL AND layer_index IS NULL)
    OR
    (parent_card_id IS NOT NULL AND layer_index IS NOT NULL AND layer_index >= 0 AND is_layer_group = false)
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_active_parent_layer_index
  ON public.flashcards(parent_card_id, layer_index)
  WHERE parent_card_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_active_smart_key
  ON public.flashcards(list_id, smart_key)
  WHERE smart_key IS NOT NULL AND deleted_at IS NULL;

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
      RAISE EXCEPTION 'layer_index só pode existir em uma camada.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS NOT NULL AND NEW.parent_card_id = NEW.id THEN
    RAISE EXCEPTION 'Um flashcard não pode ser pai de si mesmo.';
  END IF;
  IF NEW.layer_index IS NULL OR NEW.layer_index < 0 THEN
    RAISE EXCEPTION 'Toda camada precisa de layer_index não negativo.';
  END IF;
  IF NEW.is_layer_group THEN
    RAISE EXCEPTION 'Uma camada não pode ser marcada como grupo principal.';
  END IF;

  SELECT * INTO v_parent
  FROM public.flashcards
  WHERE id = NEW.parent_card_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card principal da camada não encontrado.';
  END IF;
  IF v_parent.parent_card_id IS NOT NULL THEN
    RAISE EXCEPTION 'Grupos em camadas não podem ser aninhados.';
  END IF;
  IF NOT v_parent.is_layer_group THEN
    RAISE EXCEPTION 'A camada precisa apontar para um grupo principal válido.';
  END IF;
  IF v_parent.list_id IS DISTINCT FROM NEW.list_id THEN
    RAISE EXCEPTION 'Card principal e camada precisam pertencer à mesma lista.';
  END IF;
  IF v_parent.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Card principal e camada precisam pertencer ao mesmo proprietário.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_flashcard_layer_link_v1 ON public.flashcards;
CREATE TRIGGER trg_validate_flashcard_layer_link_v1
BEFORE INSERT OR UPDATE OF parent_card_id, layer_index, list_id, user_id, is_layer_group
ON public.flashcards
FOR EACH ROW
EXECUTE FUNCTION public.validate_flashcard_layer_link_v1();

CREATE OR REPLACE FUNCTION public.assert_layer_group_size_v1(_parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF _parent_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.flashcards
    WHERE id = _parent_id
      AND deleted_at IS NULL
      AND is_layer_group = true
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.flashcards
  WHERE parent_card_id = _parent_id
    AND deleted_at IS NULL;

  IF v_count < 2 THEN
    RAISE EXCEPTION 'Um grupo em camadas precisa terminar a transação com pelo menos duas camadas.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_layer_group_size_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.assert_layer_group_size_v1(OLD.parent_card_id);
    IF OLD.is_layer_group THEN
      PERFORM public.assert_layer_group_size_v1(OLD.id);
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF NEW.parent_card_id IS DISTINCT FROM CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.parent_card_id END THEN
      PERFORM public.assert_layer_group_size_v1(NEW.parent_card_id);
    END IF;
    IF NEW.is_layer_group THEN
      PERFORM public.assert_layer_group_size_v1(NEW.id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_layer_group_size_v1 ON public.flashcards;
CREATE CONSTRAINT TRIGGER trg_validate_layer_group_size_v1
AFTER INSERT OR UPDATE OR DELETE ON public.flashcards
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_layer_group_size_v1();

CREATE OR REPLACE FUNCTION public.import_layered_group_v2(
  _uid uuid,
  _list_id uuid,
  _card jsonb,
  _card_conflict text,
  _batch_id uuid,
  _card_path text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title text := NULLIF(BTRIM(_card->>'group_title'), '');
  v_group_key text := NULLIF(BTRIM(_card->>'key'), '');
  v_effective_group_key text;
  v_copy_token text;
  v_parent_id uuid;
  v_conflict_id uuid;
  v_has_conflict boolean := false;
  v_layer_count integer;
  v_layer record;
  v_layer_path text;
  v_front text;
  v_back text;
  v_layer_key text;
  v_effective_layer_key text;
  v_word_hints jsonb;
  v_created_id uuid;
  v_snapshot jsonb;
  v_cards_created integer := 0;
  v_cards_skipped integer := 0;
  v_cards_updated integer := 0;
  v_group_created integer := 0;
  v_group_updated integer := 0;
BEGIN
  IF _card_conflict NOT IN ('skip', 'copy', 'error', 'replace') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'E_EMPTY_NAME|%s.group_title: título obrigatório.', _card_path;
  END IF;
  IF jsonb_typeof(_card->'layers') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'E_SCHEMA|%s.layers: array obrigatório.', _card_path;
  END IF;
  v_layer_count := jsonb_array_length(_card->'layers');
  IF v_layer_count < 2 THEN
    RAISE EXCEPTION 'E_SCHEMA|%s.layers: grupo exige ao menos duas camadas.', _card_path;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_card->'layers') layer
    GROUP BY lower(BTRIM(layer->>'front')), lower(BTRIM(layer->>'back'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'E_DUPLICATE_CARD|%s.layers: o grupo contém camadas duplicadas.', _card_path;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_card->'layers') layer
    WHERE NULLIF(BTRIM(layer->>'front'), '') IS NULL
       OR NULLIF(BTRIM(layer->>'back'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'E_EMPTY_CARD_SIDE|%s.layers: toda camada precisa de frente e verso.', _card_path;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_card->'layers') layer
    WHERE NULLIF(BTRIM(layer->>'key'), '') IS NOT NULL
    GROUP BY lower(BTRIM(layer->>'key'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'E_DUPLICATE_CARD|%s.layers: as chaves das camadas precisam ser únicas.', _card_path;
  END IF;

  IF v_group_key IS NOT NULL THEN
    SELECT id INTO v_parent_id
    FROM public.flashcards
    WHERE list_id = _list_id
      AND user_id = _uid
      AND parent_card_id IS NULL
      AND is_layer_group = true
      AND deleted_at IS NULL
      AND lower(smart_key) = lower(v_group_key)
    LIMIT 1;
  END IF;

  IF v_parent_id IS NULL THEN
    SELECT id INTO v_parent_id
    FROM public.flashcards parent
    WHERE parent.list_id = _list_id
      AND parent.user_id = _uid
      AND parent.parent_card_id IS NULL
      AND parent.is_layer_group = true
      AND parent.deleted_at IS NULL
      AND lower(BTRIM(parent.term)) = lower(v_title)
    LIMIT 1;
  END IF;

  SELECT existing.id INTO v_conflict_id
  FROM public.flashcards existing
  JOIN jsonb_array_elements(_card->'layers') incoming ON
    lower(BTRIM(existing.term)) = lower(BTRIM(incoming->>'front'))
    AND lower(BTRIM(existing.translation)) = lower(BTRIM(incoming->>'back'))
  WHERE existing.list_id = _list_id
    AND existing.user_id = _uid
    AND existing.deleted_at IS NULL
    AND (v_parent_id IS NULL OR (existing.id <> v_parent_id AND existing.parent_card_id IS DISTINCT FROM v_parent_id))
  LIMIT 1;

  v_has_conflict := v_parent_id IS NOT NULL OR v_conflict_id IS NOT NULL;

  IF v_has_conflict AND _card_conflict = 'error' THEN
    RAISE EXCEPTION 'E_DUPLICATE_CARD|%s: grupo em camadas duplicado ou conflitante.', _card_path;
  END IF;

  IF v_has_conflict AND _card_conflict = 'skip' THEN
    v_cards_skipped := v_layer_count;
    IF _batch_id IS NOT NULL THEN
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path
      ) VALUES (
        _batch_id, _uid, 'card', COALESCE(v_parent_id, v_conflict_id), 'skipped', _card_path
      );
    END IF;
    RETURN jsonb_build_object(
      'cards_created', 0,
      'cards_skipped', v_cards_skipped,
      'cards_updated', 0,
      'layered_groups_created', 0,
      'layered_groups_updated', 0
    );
  END IF;

  IF _card_conflict = 'replace' AND v_parent_id IS NULL AND v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'E_CONFLICT|%s: uma camada conflita com um card fora deste grupo. Use Manter os dois ou revise o destino.', _card_path;
  END IF;

  IF _card_conflict = 'copy' THEN
    v_copy_token := replace(gen_random_uuid()::text, '-', '');
  END IF;
  v_effective_group_key := CASE
    WHEN v_group_key IS NULL THEN NULL
    WHEN _card_conflict = 'copy' AND v_has_conflict THEN v_group_key || ':copy:' || v_copy_token
    ELSE v_group_key
  END;

  IF _card_conflict = 'replace' AND v_parent_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'kind', 'layered_group_snapshot',
      'parent', to_jsonb(parent),
      'children', COALESCE((
        SELECT jsonb_agg(to_jsonb(child) ORDER BY child.layer_index, child.created_at, child.id)
        FROM public.flashcards child
        WHERE child.parent_card_id = parent.id
          AND child.deleted_at IS NULL
      ), '[]'::jsonb)
    )
    INTO v_snapshot
    FROM public.flashcards parent
    WHERE parent.id = v_parent_id;

    IF _batch_id IS NOT NULL THEN
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path, metadata
      ) VALUES (
        _batch_id, _uid, 'card', v_parent_id, 'updated', _card_path || '.$replace-group', v_snapshot
      );
    END IF;

    UPDATE public.flashcards
    SET deleted_at = now(), updated_at = now()
    WHERE parent_card_id = v_parent_id
      AND deleted_at IS NULL;

    UPDATE public.flashcards
    SET term = v_title,
        translation = BTRIM((_card->'layers'->0)->>'back'),
        context_tag = v_title,
        smart_key = v_effective_group_key,
        is_layer_group = true,
        deleted_at = NULL,
        updated_at = now()
    WHERE id = v_parent_id
      AND user_id = _uid;

    v_cards_updated := v_layer_count;
    v_group_updated := 1;
  ELSE
    INSERT INTO public.flashcards(
      list_id, user_id, term, translation, context_tag, smart_key, is_layer_group
    ) VALUES (
      _list_id,
      _uid,
      v_title,
      BTRIM((_card->'layers'->0)->>'back'),
      v_title,
      v_effective_group_key,
      true
    ) RETURNING id INTO v_parent_id;

    IF _batch_id IS NOT NULL THEN
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path
      ) VALUES (
        _batch_id, _uid, 'card', v_parent_id, 'created', _card_path || '.$group'
      );
    END IF;
    v_group_created := 1;
  END IF;

  FOR v_layer IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_card->'layers') WITH ORDINALITY
  LOOP
    v_layer_path := format('%s.layers[%s]', _card_path, v_layer.ordinality - 1);
    v_front := BTRIM(v_layer.value->>'front');
    v_back := BTRIM(v_layer.value->>'back');
    v_layer_key := NULLIF(BTRIM(v_layer.value->>'key'), '');
    v_effective_layer_key := CASE
      WHEN v_layer_key IS NULL THEN NULL
      WHEN _card_conflict = 'copy' AND v_has_conflict THEN v_layer_key || ':copy:' || v_copy_token
      ELSE v_layer_key
    END;
    v_word_hints := public.smart_word_hints_for_db_v2(v_layer.value->'word_hints');

    INSERT INTO public.flashcards(
      list_id, user_id, term, translation, hint, context_tag,
      example_text, example_translation, detailed_explanation,
      usage_notes, common_mistakes, short_explanation, word_hints,
      parent_card_id, layer_index, accepted_answers_en, smart_key, is_layer_group
    ) VALUES (
      _list_id, _uid, v_front, v_back,
      NULLIF(BTRIM(v_layer.value->>'hint'), ''),
      COALESCE(NULLIF(BTRIM(v_layer.value->>'context_tag'), ''), v_title),
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
        ELSE ARRAY[BTRIM(v_layer.value->>'short_observation')] END,
      v_effective_layer_key,
      false
    ) RETURNING id INTO v_created_id;

    IF _card_conflict <> 'replace' OR v_group_updated = 0 THEN
      v_cards_created := v_cards_created + 1;
    END IF;
    IF _batch_id IS NOT NULL THEN
      INSERT INTO public.global_import_items(
        batch_id, user_id, entity_type, entity_id, action, item_path
      ) VALUES (_batch_id, _uid, 'card', v_created_id, 'created', v_layer_path);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'cards_created', v_cards_created,
    'cards_skipped', v_cards_skipped,
    'cards_updated', v_cards_updated,
    'layered_groups_created', v_group_created,
    'layered_groups_updated', v_group_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.import_smart_list_content_v2_impl(
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
  v_card record;
  v_existing_card_id uuid;
  v_created_id uuid;
  v_front text;
  v_back text;
  v_card_path text;
  v_word_hints jsonb;
  v_card_key text;
  v_effective_key text;
  v_group_report jsonb;
  v_cards_created integer := 0;
  v_cards_skipped integer := 0;
  v_cards_updated integer := 0;
  v_groups_created integer := 0;
  v_groups_updated integer := 0;
BEGIN
  IF _uid IS NULL OR _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF _card_conflict NOT IN ('skip', 'copy', 'error', 'replace') THEN
    RAISE EXCEPTION 'Política de duplicata inválida.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lists
    WHERE id = _list_id AND owner_id = _uid AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lista inválida ou sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_list) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'E_SCHEMA|%s: lista inválida.', _list_path;
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

  FOR v_card IN
    SELECT value, ordinality
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(_list->'cards') = 'array'
        THEN _list->'cards' ELSE '[]'::jsonb END
    ) WITH ORDINALITY
  LOOP
    v_card_path := format('%s.cards[%s]', _list_path, v_card.ordinality - 1);

    IF COALESCE(v_card.value->>'type', 'normal') = 'layered' THEN
      v_group_report := public.import_layered_group_v2(
        _uid, _list_id, v_card.value, _card_conflict, _batch_id, v_card_path
      );
      v_cards_created := v_cards_created + COALESCE((v_group_report->>'cards_created')::integer, 0);
      v_cards_skipped := v_cards_skipped + COALESCE((v_group_report->>'cards_skipped')::integer, 0);
      v_cards_updated := v_cards_updated + COALESCE((v_group_report->>'cards_updated')::integer, 0);
      v_groups_created := v_groups_created + COALESCE((v_group_report->>'layered_groups_created')::integer, 0);
      v_groups_updated := v_groups_updated + COALESCE((v_group_report->>'layered_groups_updated')::integer, 0);
      CONTINUE;
    END IF;

    v_front := NULLIF(BTRIM(v_card.value->>'front'), '');
    v_back := NULLIF(BTRIM(v_card.value->>'back'), '');
    v_card_key := NULLIF(BTRIM(v_card.value->>'key'), '');
    IF v_front IS NULL OR v_back IS NULL THEN
      RAISE EXCEPTION 'E_EMPTY_CARD_SIDE|%s: frente ou verso vazio.', v_card_path;
    END IF;

    v_existing_card_id := NULL;
    IF v_card_key IS NOT NULL THEN
      SELECT id INTO v_existing_card_id
      FROM public.flashcards
      WHERE list_id = _list_id
        AND user_id = _uid
        AND deleted_at IS NULL
        AND lower(smart_key) = lower(v_card_key)
      LIMIT 1;
    END IF;
    IF v_existing_card_id IS NULL THEN
      SELECT id INTO v_existing_card_id
      FROM public.flashcards
      WHERE list_id = _list_id
        AND user_id = _uid
        AND deleted_at IS NULL
        AND lower(BTRIM(term)) = lower(v_front)
        AND lower(BTRIM(translation)) = lower(v_back)
      LIMIT 1;
    END IF;

    IF v_existing_card_id IS NOT NULL AND _card_conflict = 'error' THEN
      RAISE EXCEPTION 'E_DUPLICATE_CARD|%s: card duplicado.', v_card_path;
    ELSIF v_existing_card_id IS NOT NULL AND _card_conflict = 'skip' THEN
      v_cards_skipped := v_cards_skipped + 1;
      IF _batch_id IS NOT NULL THEN
        INSERT INTO public.global_import_items(
          batch_id, user_id, entity_type, entity_id, action, item_path
        ) VALUES (_batch_id, _uid, 'card', v_existing_card_id, 'skipped', v_card_path);
      END IF;
    ELSIF v_existing_card_id IS NOT NULL AND _card_conflict = 'replace' THEN
      IF _batch_id IS NOT NULL THEN
        INSERT INTO public.global_import_items(
          batch_id, user_id, entity_type, entity_id, action, item_path, metadata
        )
        SELECT _batch_id, _uid, 'card', card.id, 'updated', v_card_path || '.$replace', to_jsonb(card)
        FROM public.flashcards card
        WHERE card.id = v_existing_card_id;
      END IF;

      UPDATE public.flashcards
      SET term = v_front,
          translation = v_back,
          hint = NULLIF(BTRIM(v_card.value->>'hint'), ''),
          context_tag = NULLIF(BTRIM(v_card.value->>'context_tag'), ''),
          example_text = NULLIF(BTRIM(v_card.value->>'example'), ''),
          example_translation = NULLIF(BTRIM(v_card.value->>'example_translation'), ''),
          detailed_explanation = NULLIF(BTRIM(v_card.value->>'detailed_explanation'), ''),
          usage_notes = NULLIF(BTRIM(v_card.value->>'usage_notes'), ''),
          common_mistakes = NULLIF(BTRIM(v_card.value->>'common_mistakes'), ''),
          short_explanation = NULLIF(BTRIM(v_card.value->>'short_observation'), ''),
          word_hints = public.smart_word_hints_for_db_v2(v_card.value->'word_hints'),
          smart_key = v_card_key,
          is_layer_group = false,
          parent_card_id = NULL,
          layer_index = NULL,
          updated_at = now()
      WHERE id = v_existing_card_id AND user_id = _uid;
      v_cards_updated := v_cards_updated + 1;
    ELSE
      v_effective_key := CASE
        WHEN _card_conflict = 'copy' AND v_existing_card_id IS NOT NULL AND v_card_key IS NOT NULL
          THEN v_card_key || ':copy:' || replace(gen_random_uuid()::text, '-', '')
        ELSE v_card_key
      END;
      v_word_hints := public.smart_word_hints_for_db_v2(v_card.value->'word_hints');
      INSERT INTO public.flashcards(
        list_id, user_id, term, translation, hint, context_tag,
        example_text, example_translation, detailed_explanation,
        usage_notes, common_mistakes, short_explanation, word_hints,
        accepted_answers_en, smart_key, is_layer_group
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
          ELSE ARRAY[BTRIM(v_card.value->>'short_observation')] END,
        v_effective_key,
        false
      ) RETURNING id INTO v_created_id;

      v_cards_created := v_cards_created + 1;
      IF _batch_id IS NOT NULL THEN
        INSERT INTO public.global_import_items(
          batch_id, user_id, entity_type, entity_id, action, item_path
        ) VALUES (_batch_id, _uid, 'card', v_created_id, 'created', v_card_path);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'cards_created', v_cards_created,
    'cards_skipped', v_cards_skipped,
    'cards_updated', v_cards_updated,
    'layered_groups_created', v_groups_created,
    'layered_groups_updated', v_groups_updated,
    'glossary_created', 0,
    'glossary_updated', 0
  );
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
  v_card_path text;
  v_list_path text;
  v_list_id uuid;
  v_result jsonb;
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
      v_list_path := format(
        'package.folders[%s].lists[%s]',
        v_folder.ordinality - 1,
        v_list.ordinality - 1
      );
      SELECT entity_id INTO v_list_id
      FROM public.global_import_items
      WHERE batch_id = _batch_id
        AND user_id = v_uid
        AND entity_type = 'list'
        AND item_path = v_list_path
        AND entity_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 1;

      IF v_list_id IS NULL THEN
        CONTINUE;
      END IF;

      FOR v_card IN
        SELECT value, ordinality
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(v_list.value->'cards') = 'array'
            THEN v_list.value->'cards' ELSE '[]'::jsonb END
        ) WITH ORDINALITY
      LOOP
        v_card_path := format('%s.cards[%s]', v_list_path, v_card.ordinality - 1);
        IF COALESCE(v_card.value->>'type', 'normal') = 'layered' THEN
          v_result := public.import_layered_group_v2(
            v_uid, v_list_id, v_card.value, 'replace', _batch_id, v_card_path
          );
          v_updated := v_updated + COALESCE((v_result->>'cards_updated')::integer, 0);
        ELSE
          IF public.replace_super_import_skipped_card_v1(
            _batch_id, v_card_path, v_card.value
          ) THEN
            v_updated := v_updated + 1;
          END IF;
        END IF;
      END LOOP;
      v_list_id := NULL;
    END LOOP;
  END LOOP;

  RETURN v_updated;
END;
$$;

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
  v_parent jsonb;
  v_child jsonb;
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
    IF v_meta->>'kind' = 'layered_group_snapshot' THEN
      v_parent := v_meta->'parent';
      UPDATE public.flashcards
      SET term = v_parent->>'term',
          translation = v_parent->>'translation',
          hint = v_parent->>'hint',
          context_tag = v_parent->>'context_tag',
          example_text = v_parent->>'example_text',
          example_translation = v_parent->>'example_translation',
          detailed_explanation = v_parent->>'detailed_explanation',
          usage_notes = v_parent->>'usage_notes',
          common_mistakes = v_parent->>'common_mistakes',
          short_explanation = v_parent->>'short_explanation',
          word_hints = v_parent->'word_hints',
          accepted_answers_en = CASE WHEN jsonb_typeof(v_parent->'accepted_answers_en') = 'array'
            THEN ARRAY(SELECT jsonb_array_elements_text(v_parent->'accepted_answers_en')) ELSE NULL END,
          accepted_answers_pt = CASE WHEN jsonb_typeof(v_parent->'accepted_answers_pt') = 'array'
            THEN ARRAY(SELECT jsonb_array_elements_text(v_parent->'accepted_answers_pt')) ELSE NULL END,
          parent_card_id = NULLIF(v_parent->>'parent_card_id', '')::uuid,
          layer_index = NULLIF(v_parent->>'layer_index', '')::integer,
          smart_key = NULLIF(v_parent->>'smart_key', ''),
          is_layer_group = COALESCE((v_parent->>'is_layer_group')::boolean, true),
          deleted_at = NULLIF(v_parent->>'deleted_at', '')::timestamptz,
          updated_at = COALESCE(NULLIF(v_parent->>'updated_at', '')::timestamptz, now())
      WHERE id = v_item.entity_id AND user_id = v_uid;

      FOR v_child IN SELECT value FROM jsonb_array_elements(v_meta->'children')
      LOOP
        UPDATE public.flashcards
        SET term = v_child->>'term',
            translation = v_child->>'translation',
            hint = v_child->>'hint',
            context_tag = v_child->>'context_tag',
            example_text = v_child->>'example_text',
            example_translation = v_child->>'example_translation',
            detailed_explanation = v_child->>'detailed_explanation',
            usage_notes = v_child->>'usage_notes',
            common_mistakes = v_child->>'common_mistakes',
            short_explanation = v_child->>'short_explanation',
            word_hints = v_child->'word_hints',
            accepted_answers_en = CASE WHEN jsonb_typeof(v_child->'accepted_answers_en') = 'array'
              THEN ARRAY(SELECT jsonb_array_elements_text(v_child->'accepted_answers_en')) ELSE NULL END,
            accepted_answers_pt = CASE WHEN jsonb_typeof(v_child->'accepted_answers_pt') = 'array'
              THEN ARRAY(SELECT jsonb_array_elements_text(v_child->'accepted_answers_pt')) ELSE NULL END,
            parent_card_id = NULLIF(v_child->>'parent_card_id', '')::uuid,
            layer_index = NULLIF(v_child->>'layer_index', '')::integer,
            smart_key = NULLIF(v_child->>'smart_key', ''),
            is_layer_group = COALESCE((v_child->>'is_layer_group')::boolean, false),
            deleted_at = NULLIF(v_child->>'deleted_at', '')::timestamptz,
            updated_at = COALESCE(NULLIF(v_child->>'updated_at', '')::timestamptz, now())
        WHERE id = (v_child->>'id')::uuid AND user_id = v_uid;
      END LOOP;
      v_restored := v_restored + 1;
      CONTINUE;
    END IF;

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
          THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'note_text')) ELSE NULL END,
        word_hints = v_meta->'word_hints',
        accepted_answers_en = CASE WHEN jsonb_typeof(v_meta->'accepted_answers_en') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'accepted_answers_en')) ELSE NULL END,
        accepted_answers_pt = CASE WHEN jsonb_typeof(v_meta->'accepted_answers_pt') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'accepted_answers_pt')) ELSE NULL END,
        parent_card_id = NULLIF(v_meta->>'parent_card_id', '')::uuid,
        layer_index = NULLIF(v_meta->>'layer_index', '')::integer,
        smart_key = NULLIF(v_meta->>'smart_key', ''),
        is_layer_group = COALESCE((v_meta->>'is_layer_group')::boolean, false),
        status_group_uid = NULLIF(v_meta->>'status_group_uid', '')::uuid,
        deleted_at = NULLIF(v_meta->>'deleted_at', '')::timestamptz,
        updated_at = COALESCE(NULLIF(v_meta->>'updated_at', '')::timestamptz, now())
    WHERE id = v_item.entity_id AND user_id = v_uid;

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
  PERFORM public.undo_global_import_v1(_batch_id);
  PERFORM public.restore_super_import_updated_cards_v1(_batch_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_classroom_global_import_v2(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.undo_classroom_global_import_v1(_batch_id);
  PERFORM public.restore_super_import_updated_cards_v1(_batch_id);
END;
$$;

REVOKE ALL ON FUNCTION public.import_layered_group_v2(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_smart_list_content_v2_impl(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_super_import_duplicate_replacements_v1(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_super_import_updated_cards_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_global_import_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_classroom_global_import_v2(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2_impl(uuid,uuid,jsonb,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_classroom_global_import_v2(uuid) TO authenticated;

COMMIT;
