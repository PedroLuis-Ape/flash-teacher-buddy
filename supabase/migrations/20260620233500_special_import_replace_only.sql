-- Super Importador de Especiais: a nova importação substitui o pacote anterior inteiro.
-- A edição manual do card continua disponível para complementos posteriores.
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
  v_existing record;
  v_status text;
  v_message text;
  v_results jsonb := '[]'::jsonb;
  v_applied int := 0;
  v_removed int := 0;
  v_kept int := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_status := NULL;
    v_message := NULL;

    BEGIN
      BEGIN
        v_fid := (v_item->>'flashcard_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_fid := NULL;
      END;

      IF v_fid IS NULL OR NULLIF(trim(v_item->>'detailed_explanation'), '') IS NULL THEN
        v_status := 'invalid';
        v_message := 'flashcard_id inválido ou detailed_explanation vazia.';
      ELSE
        SELECT f.user_id AS owner_id, l.class_id, t.owner_teacher_id
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
            UPDATE public.flashcards
               SET detailed_explanation = NULLIF(trim(v_item->>'detailed_explanation'), ''),
                   usage_notes = NULLIF(trim(v_item->>'usage_notes'), ''),
                   common_mistakes = NULLIF(trim(v_item->>'common_mistakes'), ''),
                   example_text = NULLIF(trim(v_item->>'example_text'), ''),
                   example_translation = NULLIF(trim(v_item->>'example_translation'), ''),
                   updated_at = now()
             WHERE id = v_fid;

            IF NOT FOUND THEN
              RAISE EXCEPTION 'FLASHCARD_UPDATE_FAILED';
            END IF;

            DELETE FROM public.user_special_flashcards
             WHERE id = v_special_id
               AND user_id = v_user
               AND flashcard_id = v_fid;

            IF NOT FOUND THEN
              RAISE EXCEPTION 'SPECIAL_QUEUE_DELETE_FAILED';
            END IF;

            v_status := 'applied';
            v_applied := v_applied + 1;
            v_removed := v_removed + 1;
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
        'explanation_updated', v_status = 'applied',
        'removed_from_specials', v_status = 'applied',
        'replacement_policy', 'replace_only'
      ));
    EXCEPTION WHEN OTHERS THEN
      v_kept := v_kept + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'flashcard_id', v_item->>'flashcard_id',
        'status', 'error',
        'message', SQLERRM,
        'explanation_updated', false,
        'removed_from_specials', false,
        'replacement_policy', 'replace_only'
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'replacement_policy', 'replace_only',
    'results', v_results,
    'applied_count', v_applied,
    'removed_from_specials_count', v_removed,
    'kept_in_specials_count', v_kept
  );
END;
$$;

COMMENT ON FUNCTION public.apply_special_flashcard_explanations(jsonb, text) IS
  'Substitui integralmente a explicação especial e remove o card da fila na mesma transação.';
