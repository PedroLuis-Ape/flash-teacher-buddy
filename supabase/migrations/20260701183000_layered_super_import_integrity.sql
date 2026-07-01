-- App Piteco — preserve and import layered groups atomically
BEGIN;

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

COMMIT;
