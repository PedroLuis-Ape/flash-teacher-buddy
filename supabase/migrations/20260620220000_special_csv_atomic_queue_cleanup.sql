-- Cards Especiais: atualização da explicação e remoção da fila na mesma transação por item.
-- O contrato da RPC permanece compatível; apenas acrescenta campos de confirmação.

CREATE OR REPLACE FUNCTION public.apply_special_flashcard_explanations(
  p_items jsonb,
  p_conflict_mode text DEFAULT 'replace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item jsonb;
  v_fid uuid;
  v_special_id uuid;
  v_explanation text;
  v_usage_notes text;
  v_common_mistakes text;
  v_example_text text;
  v_example_translation text;
  v_existing record;
  v_update_count int;
  v_delete_count int;
  v_results jsonb := '[]'::jsonb;
  v_applied int := 0;
  v_removed int := 0;
  v_kept int := 0;
  v_status text;
  v_message text;
  v_explanation_updated boolean;
  v_removed_from_specials boolean;
  v_conflict text := COALESCE(NULLIF(p_conflict_mode, ''), 'replace');
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  IF v_conflict NOT IN ('replace', 'append', 'skip') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CONFLICT_MODE');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_status := NULL;
    v_message := NULL;
    v_explanation_updated := false;
    v_removed_from_specials := false;

    BEGIN
      BEGIN
        v_fid := (v_item->>'flashcard_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_fid := NULL;
      END;

      v_explanation := NULLIF(trim(v_item->>'detailed_explanation'), '');

      IF v_fid IS NULL OR v_explanation IS NULL THEN
        v_status := 'invalid';
        v_message := 'flashcard_id inválido ou detailed_explanation vazia.';
      ELSE
        v_usage_notes := NULLIF(v_item->>'usage_notes', '');
        v_common_mistakes := NULLIF(v_item->>'common_mistakes', '');
        v_example_text := NULLIF(v_item->>'example_text', '');
        v_example_translation := NULLIF(v_item->>'example_translation', '');

        SELECT f.id,
               f.detailed_explanation,
               f.example_text,
               f.example_translation,
               f.user_id AS owner_id,
               f.list_id,
               l.class_id,
               t.owner_teacher_id
          INTO v_existing
          FROM public.flashcards f
          JOIN public.lists l ON l.id = f.list_id
          LEFT JOIN public.turmas t ON t.id = l.class_id
         WHERE f.id = v_fid
           AND f.deleted_at IS NULL;

        IF NOT FOUND THEN
          v_status := 'not_found';
          v_message := 'Card não encontrado.';
        ELSIF v_existing.owner_id <> v_user
              AND (v_existing.class_id IS NULL
                   OR v_existing.owner_teacher_id IS NULL
                   OR v_existing.owner_teacher_id <> v_user) THEN
          v_status := 'permission_denied';
          v_message := 'Usuário sem permissão para alterar o card.';
        ELSE
          SELECT id
            INTO v_special_id
            FROM public.user_special_flashcards
           WHERE user_id = v_user
             AND flashcard_id = v_fid
           FOR UPDATE;

          IF NOT FOUND THEN
            v_status := 'not_in_specials';
            v_message := 'O card não está mais na fila de Especiais.';
          ELSE
            IF v_existing.detailed_explanation IS NOT NULL
               AND length(trim(v_existing.detailed_explanation)) > 0 THEN
              IF v_conflict = 'skip' THEN
                v_status := 'skipped';
              ELSIF v_conflict = 'append' THEN
                v_explanation := v_existing.detailed_explanation
                  || E'\n\n---\n\n' || v_explanation;
              END IF;
            END IF;

            IF v_status IS NULL THEN
              UPDATE public.flashcards SET
                detailed_explanation = v_explanation,
                usage_notes = COALESCE(v_usage_notes, usage_notes),
                common_mistakes = COALESCE(v_common_mistakes, common_mistakes),
                example_text = CASE
                  WHEN (v_existing.example_text IS NULL OR v_existing.example_text = '')
                       AND v_example_text IS NOT NULL THEN v_example_text
                  ELSE example_text
                END,
                example_translation = CASE
                  WHEN (v_existing.example_translation IS NULL OR v_existing.example_translation = '')
                       AND v_example_translation IS NOT NULL THEN v_example_translation
                  ELSE example_translation
                END,
                updated_at = now()
               WHERE id = v_fid;

              GET DIAGNOSTICS v_update_count = ROW_COUNT;
              IF v_update_count <> 1 THEN
                RAISE EXCEPTION 'FLASHCARD_UPDATE_COUNT_%', v_update_count;
              END IF;
              v_explanation_updated := true;

              DELETE FROM public.user_special_flashcards
               WHERE id = v_special_id
                 AND user_id = v_user
                 AND flashcard_id = v_fid;

              GET DIAGNOSTICS v_delete_count = ROW_COUNT;
              IF v_delete_count <> 1 THEN
                RAISE EXCEPTION 'SPECIAL_QUEUE_DELETE_COUNT_%', v_delete_count;
              END IF;
              v_removed_from_specials := true;

              v_status := 'applied';
              v_applied := v_applied + 1;
              v_removed := v_removed + 1;
            END IF;
          END IF;
        END IF;
      END IF;

      IF v_status <> 'applied' THEN
        v_kept := v_kept + 1;
      END IF;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'flashcard_id', v_item->>'flashcard_id',
        'status', v_status,
        'message', v_message,
        'explanation_updated', v_explanation_updated,
        'removed_from_specials', v_removed_from_specials
      ));
    EXCEPTION WHEN OTHERS THEN
      -- Como este bloco possui EXCEPTION, UPDATE e DELETE deste item são revertidos juntos.
      v_kept := v_kept + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'flashcard_id', v_item->>'flashcard_id',
        'status', 'error',
        'message', SQLERRM,
        'explanation_updated', false,
        'removed_from_specials', false
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'results', v_results,
    'applied_count', v_applied,
    'removed_from_specials_count', v_removed,
    'kept_in_specials_count', v_kept
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_special_flashcard_explanations(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_special_flashcard_explanations(jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_special_flashcard_explanations(jsonb, text) TO authenticated;

COMMENT ON FUNCTION public.apply_special_flashcard_explanations(jsonb, text) IS
  'Aplica explicações em lote e remove cada card da fila de Especiais atomicamente somente após atualização confirmada.';
