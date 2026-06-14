-- ============================================================================
-- 1) set_flashcard_group_favorite
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_flashcard_group_favorite(
  p_canonical_id uuid,
  p_cleanup_ids uuid[],
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_all uuid[];
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_canonical_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Build unique union of canonical + cleanup
  SELECT ARRAY(SELECT DISTINCT x FROM unnest(p_cleanup_ids || ARRAY[p_canonical_id]) AS x WHERE x IS NOT NULL)
    INTO v_all;

  IF NOT p_enabled THEN
    DELETE FROM public.user_favorites
     WHERE user_id = v_user
       AND resource_type = 'flashcard'
       AND resource_id = ANY(v_all);
    -- Favorite × Red List invariant
    DELETE FROM public.user_red_list
     WHERE user_id = v_user
       AND flashcard_id = ANY(v_all);
    RETURN jsonb_build_object('success', true, 'enabled', false);
  END IF;

  -- Enable: scrub legacy per-layer entries, then insert canonical
  DELETE FROM public.user_favorites
   WHERE user_id = v_user
     AND resource_type = 'flashcard'
     AND resource_id = ANY(v_all)
     AND resource_id <> p_canonical_id;

  INSERT INTO public.user_favorites (user_id, resource_type, resource_id)
  VALUES (v_user, 'flashcard', p_canonical_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'enabled', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_flashcard_group_favorite(uuid, uuid[], boolean) TO authenticated;

-- ============================================================================
-- 2) set_flashcard_group_red_list
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_flashcard_group_red_list(
  p_canonical_id uuid,
  p_cleanup_ids uuid[],
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_all uuid[];
  v_has_fav boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_canonical_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT ARRAY(SELECT DISTINCT x FROM unnest(p_cleanup_ids || ARRAY[p_canonical_id]) AS x WHERE x IS NOT NULL)
    INTO v_all;

  IF NOT p_enabled THEN
    DELETE FROM public.user_red_list
     WHERE user_id = v_user
       AND flashcard_id = ANY(v_all);
    RETURN jsonb_build_object('success', true, 'enabled', false);
  END IF;

  -- Require an existing favorite somewhere in the group
  SELECT EXISTS (
    SELECT 1 FROM public.user_favorites
     WHERE user_id = v_user
       AND resource_type = 'flashcard'
       AND resource_id = ANY(v_all)
  ) INTO v_has_fav;

  IF NOT v_has_fav THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FAVORITED',
      'message', 'Marque o card como favorito antes de adicionar à Lista Vermelha.');
  END IF;

  -- Normalize favorite to canonical if it lives on a legacy id
  IF NOT EXISTS (
    SELECT 1 FROM public.user_favorites
     WHERE user_id = v_user AND resource_type = 'flashcard' AND resource_id = p_canonical_id
  ) THEN
    DELETE FROM public.user_favorites
     WHERE user_id = v_user
       AND resource_type = 'flashcard'
       AND resource_id = ANY(v_all)
       AND resource_id <> p_canonical_id;
    INSERT INTO public.user_favorites (user_id, resource_type, resource_id)
    VALUES (v_user, 'flashcard', p_canonical_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Scrub legacy red entries then insert canonical
  DELETE FROM public.user_red_list
   WHERE user_id = v_user
     AND flashcard_id = ANY(v_all)
     AND flashcard_id <> p_canonical_id;

  INSERT INTO public.user_red_list (user_id, flashcard_id)
  VALUES (v_user, p_canonical_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'enabled', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_flashcard_group_red_list(uuid, uuid[], boolean) TO authenticated;

-- ============================================================================
-- 3) apply_special_flashcard_explanations
--    Per-item SAVEPOINT semantics via inner BEGIN/EXCEPTION blocks.
--    Only deletes the special row when exactly 1 flashcards row was updated.
-- ============================================================================
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
  v_explanation text;
  v_usage_notes text;
  v_common_mistakes text;
  v_example_text text;
  v_example_translation text;
  v_existing record;
  v_rowcount int;
  v_results jsonb := '[]'::jsonb;
  v_applied int := 0;
  v_kept int := 0;
  v_status text;
  v_conflict text := COALESCE(NULLIF(p_conflict_mode, ''), 'replace');
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
    BEGIN
      -- Parse + validate input
      BEGIN
        v_fid := (v_item->>'flashcard_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_fid := NULL;
      END;
      v_explanation := NULLIF(v_item->>'detailed_explanation', '');

      IF v_fid IS NULL OR v_explanation IS NULL THEN
        v_status := 'invalid';
      ELSE
        v_usage_notes := v_item->>'usage_notes';
        v_common_mistakes := v_item->>'common_mistakes';
        v_example_text := v_item->>'example_text';
        v_example_translation := v_item->>'example_translation';

        -- Fetch existing row (respect ownership via owner_id OR turma owner)
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
        ELSIF v_existing.owner_id <> v_user
              AND (v_existing.class_id IS NULL
                   OR v_existing.owner_teacher_id IS NULL
                   OR v_existing.owner_teacher_id <> v_user) THEN
          v_status := 'permission_denied';
        ELSE
          -- Conflict handling
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
                ELSE example_text END,
              example_translation = CASE
                WHEN (v_existing.example_translation IS NULL OR v_existing.example_translation = '')
                     AND v_example_translation IS NOT NULL THEN v_example_translation
                ELSE example_translation END,
              updated_at = now()
             WHERE id = v_fid;
            GET DIAGNOSTICS v_rowcount = ROW_COUNT;

            IF v_rowcount = 1 THEN
              DELETE FROM public.user_special_flashcards
               WHERE user_id = v_user AND flashcard_id = v_fid;
              v_status := 'applied';
              v_applied := v_applied + 1;
            ELSE
              v_status := 'error';
            END IF;
          END IF;
        END IF;
      END IF;

      IF v_status <> 'applied' THEN
        v_kept := v_kept + 1;
      END IF;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'flashcard_id', v_item->>'flashcard_id',
        'status', v_status
      ));
    EXCEPTION WHEN OTHERS THEN
      v_kept := v_kept + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'flashcard_id', v_item->>'flashcard_id',
        'status', 'error',
        'message', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'results', v_results,
    'applied_count', v_applied,
    'kept_in_specials_count', v_kept
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_special_flashcard_explanations(jsonb, text) TO authenticated;