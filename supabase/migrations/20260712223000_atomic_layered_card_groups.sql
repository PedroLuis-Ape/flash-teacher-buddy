BEGIN;

CREATE OR REPLACE FUNCTION public.save_layered_card_group_v2(
  _principal_id uuid,
  _list_id uuid,
  _title text,
  _layers jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_list record;
  v_principal_id uuid := _principal_id;
  v_layer record;
  v_layer_id uuid;
  v_saved_id uuid;
  v_front text;
  v_back text;
  v_title text := NULLIF(BTRIM(_title), '');
  v_kept_ids uuid[] := ARRAY[]::uuid[];
  v_layer_ids jsonb := '[]'::jsonb;
  v_first_back text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT l.id, l.owner_id, l.class_id, t.owner_teacher_id
  INTO v_list
  FROM public.lists l
  LEFT JOIN public.turmas t ON t.id = l.class_id
  WHERE l.id = _list_id
    AND l.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lista não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF v_list.owner_id IS DISTINCT FROM v_uid
     AND (v_list.class_id IS NULL OR v_list.owner_teacher_id IS DISTINCT FROM v_uid) THEN
    RAISE EXCEPTION 'Você não tem permissão para editar camadas nesta lista.' USING ERRCODE = '42501';
  END IF;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'O título do card em camadas é obrigatório.';
  END IF;

  IF jsonb_typeof(_layers) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'As camadas precisam ser enviadas como uma lista.';
  END IF;
  IF jsonb_array_length(_layers) < 2 THEN
    RAISE EXCEPTION 'Um card em camadas precisa ter pelo menos duas camadas.';
  END IF;
  IF jsonb_array_length(_layers) > 500 THEN
    RAISE EXCEPTION 'Um card em camadas pode ter no máximo 500 camadas.';
  END IF;

  FOR v_layer IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_layers) WITH ORDINALITY
  LOOP
    v_front := NULLIF(BTRIM(v_layer.value->>'front'), '');
    v_back := NULLIF(BTRIM(v_layer.value->>'back'), '');
    IF v_front IS NULL OR v_back IS NULL THEN
      RAISE EXCEPTION 'A Camada % precisa ter conteúdo nos dois lados.', v_layer.ordinality;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        lower(BTRIM(value->>'front')) AS front_key,
        lower(BTRIM(value->>'back')) AS back_key,
        count(*)
      FROM jsonb_array_elements(_layers)
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) duplicate_pair
  ) THEN
    RAISE EXCEPTION 'O grupo contém duas camadas exatamente iguais.';
  END IF;

  IF v_principal_id IS NULL THEN
    v_first_back := BTRIM(_layers->0->>'back');
    INSERT INTO public.flashcards(
      list_id, user_id, term, translation, context_tag
    ) VALUES (
      _list_id, v_uid, v_title, v_first_back, v_title
    ) RETURNING id INTO v_principal_id;
  ELSE
    PERFORM 1
    FROM public.flashcards f
    WHERE f.id = v_principal_id
      AND f.list_id = _list_id
      AND f.parent_card_id IS NULL
      AND f.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Card principal não encontrado ou inválido.' USING ERRCODE = '42501';
    END IF;

    WITH ordered AS (
      SELECT
        id,
        row_number() OVER (
          ORDER BY COALESCE(layer_index, 0), created_at, id
        ) - 1 AS layer_index
      FROM public.flashcards
      WHERE parent_card_id = v_principal_id
        AND deleted_at IS NULL
    )
    UPDATE public.flashcards child
    SET layer_index = 1000000 + ordered.layer_index,
        updated_at = now()
    FROM ordered
    WHERE child.id = ordered.id;
  END IF;

  FOR v_layer IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_layers) WITH ORDINALITY
    ORDER BY ordinality
  LOOP
    v_front := BTRIM(v_layer.value->>'front');
    v_back := BTRIM(v_layer.value->>'back');
    v_layer_id := NULLIF(BTRIM(v_layer.value->>'id'), '')::uuid;
    v_saved_id := NULL;

    IF v_layer_id IS NOT NULL THEN
      UPDATE public.flashcards f
      SET term = v_front,
          translation = v_back,
          hint = CASE WHEN v_layer.value ? 'hint'
            THEN NULLIF(BTRIM(v_layer.value->>'hint'), '') ELSE f.hint END,
          context_tag = CASE WHEN v_layer.value ? 'context_tag'
            THEN NULLIF(BTRIM(v_layer.value->>'context_tag'), '') ELSE f.context_tag END,
          example_text = CASE WHEN v_layer.value ? 'example'
            THEN NULLIF(BTRIM(v_layer.value->>'example'), '') ELSE f.example_text END,
          example_translation = CASE WHEN v_layer.value ? 'example_translation'
            THEN NULLIF(BTRIM(v_layer.value->>'example_translation'), '') ELSE f.example_translation END,
          detailed_explanation = CASE WHEN v_layer.value ? 'detailed_explanation'
            THEN NULLIF(BTRIM(v_layer.value->>'detailed_explanation'), '') ELSE f.detailed_explanation END,
          usage_notes = CASE WHEN v_layer.value ? 'usage_notes'
            THEN NULLIF(BTRIM(v_layer.value->>'usage_notes'), '') ELSE f.usage_notes END,
          common_mistakes = CASE WHEN v_layer.value ? 'common_mistakes'
            THEN NULLIF(BTRIM(v_layer.value->>'common_mistakes'), '') ELSE f.common_mistakes END,
          short_explanation = CASE WHEN v_layer.value ? 'short_observation'
            THEN NULLIF(BTRIM(v_layer.value->>'short_observation'), '') ELSE f.short_explanation END,
          word_hints = CASE WHEN v_layer.value ? 'word_hints'
            THEN public.smart_word_hints_for_db_v2(v_layer.value->'word_hints') ELSE f.word_hints END,
          layer_index = v_layer.ordinality - 1,
          deleted_at = NULL,
          updated_at = now()
      WHERE f.id = v_layer_id
        AND f.parent_card_id = v_principal_id
        AND f.list_id = _list_id
      RETURNING f.id INTO v_saved_id;

      IF v_saved_id IS NULL THEN
        RAISE EXCEPTION 'A Camada % não pertence a este card.', v_layer.ordinality;
      END IF;
    ELSE
      INSERT INTO public.flashcards(
        list_id, user_id, term, translation, hint, context_tag,
        example_text, example_translation, detailed_explanation,
        usage_notes, common_mistakes, short_explanation, word_hints,
        parent_card_id, layer_index
      ) VALUES (
        _list_id,
        v_uid,
        v_front,
        v_back,
        NULLIF(BTRIM(v_layer.value->>'hint'), ''),
        COALESCE(NULLIF(BTRIM(v_layer.value->>'context_tag'), ''), v_title),
        NULLIF(BTRIM(v_layer.value->>'example'), ''),
        NULLIF(BTRIM(v_layer.value->>'example_translation'), ''),
        NULLIF(BTRIM(v_layer.value->>'detailed_explanation'), ''),
        NULLIF(BTRIM(v_layer.value->>'usage_notes'), ''),
        NULLIF(BTRIM(v_layer.value->>'common_mistakes'), ''),
        NULLIF(BTRIM(v_layer.value->>'short_observation'), ''),
        public.smart_word_hints_for_db_v2(v_layer.value->'word_hints'),
        v_principal_id,
        v_layer.ordinality - 1
      ) RETURNING id INTO v_saved_id;
    END IF;

    v_kept_ids := array_append(v_kept_ids, v_saved_id);
    v_layer_ids := v_layer_ids || jsonb_build_array(v_saved_id);
  END LOOP;

  UPDATE public.flashcards
  SET deleted_at = now(),
      updated_at = now()
  WHERE parent_card_id = v_principal_id
    AND deleted_at IS NULL
    AND NOT (id = ANY(v_kept_ids));

  UPDATE public.flashcards
  SET term = v_title,
      translation = BTRIM(_layers->0->>'back'),
      context_tag = COALESCE(context_tag, v_title),
      updated_at = now()
  WHERE id = v_principal_id;

  RETURN jsonb_build_object(
    'success', true,
    'principal_id', v_principal_id,
    'layer_count', jsonb_array_length(_layers),
    'layer_ids', v_layer_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_layered_card_group_v2(uuid,uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_layered_card_group_v2(uuid,uuid,text,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_layered_card_group_v2(uuid,uuid,text,jsonb) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
