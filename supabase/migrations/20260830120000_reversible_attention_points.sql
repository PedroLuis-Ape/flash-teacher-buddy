BEGIN;

-- Pontos de atenção keep the existing table name for import/export compatibility,
-- but the canonical identity is now one row per source group, never per clone.
ALTER TABLE public.user_special_flashcards
  ADD COLUMN IF NOT EXISTS source_group_id uuid,
  ADD COLUMN IF NOT EXISTS attention_area_id uuid,
  ADD COLUMN IF NOT EXISTS materialization_list_id uuid,
  ADD COLUMN IF NOT EXISTS materialization_group_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_attention_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_special_flashcards
  DROP CONSTRAINT IF EXISTS user_special_flashcards_source_group_id_fkey,
  DROP CONSTRAINT IF EXISTS user_special_flashcards_attention_area_id_fkey,
  DROP CONSTRAINT IF EXISTS user_special_flashcards_materialization_list_id_fkey,
  DROP CONSTRAINT IF EXISTS user_special_flashcards_materialization_group_id_fkey;

ALTER TABLE public.user_special_flashcards
  ADD CONSTRAINT user_special_flashcards_source_group_id_fkey
    FOREIGN KEY (source_group_id) REFERENCES public.flashcards(id) ON DELETE CASCADE,
  ADD CONSTRAINT user_special_flashcards_attention_area_id_fkey
    FOREIGN KEY (attention_area_id) REFERENCES public.user_attention_areas(id) ON DELETE SET NULL,
  ADD CONSTRAINT user_special_flashcards_materialization_list_id_fkey
    FOREIGN KEY (materialization_list_id) REFERENCES public.lists(id) ON DELETE SET NULL,
  ADD CONSTRAINT user_special_flashcards_materialization_group_id_fkey
    FOREIGN KEY (materialization_group_id) REFERENCES public.flashcards(id) ON DELETE SET NULL;

-- Existing rows are migrated to the stable group identity. If an old import had
-- several layers of one group, retain one canonical row (prefer a row with focus,
-- then the oldest row) instead of creating duplicate active points.
UPDATE public.user_special_flashcards s
SET source_group_id = COALESCE(f.status_group_uid, f.parent_card_id, f.id),
    list_id = COALESCE(s.list_id, f.list_id),
    is_active = COALESCE(s.is_active, true)
FROM public.flashcards f
WHERE f.id = s.flashcard_id
  AND s.source_group_id IS NULL;

WITH ranked AS (
  SELECT
    s.id,
    row_number() OVER (
      PARTITION BY s.user_id, s.source_group_id
      ORDER BY (
        s.focus_text IS NOT NULL
        OR s.focus_tag IS NOT NULL
        OR s.focus_note IS NOT NULL
      ) DESC, s.created_at ASC, s.id ASC
    ) AS rn
  FROM public.user_special_flashcards s
  WHERE s.source_group_id IS NOT NULL
    AND s.is_active = true
)
DELETE FROM public.user_special_flashcards s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE INDEX IF NOT EXISTS idx_user_special_flashcards_active_group
  ON public.user_special_flashcards(user_id, source_group_id)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_special_flashcards_active_group
  ON public.user_special_flashcards(user_id, source_group_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_special_flashcards_materialization
  ON public.user_special_flashcards(user_id, materialization_group_id)
  WHERE materialization_group_id IS NOT NULL;

-- The canonical row is writable only by the SECURITY DEFINER mutation below.
-- Keeping SELECT for the queue preserves export/read compatibility while
-- preventing a second client-side INSERT/UPDATE/DELETE path.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_special_flashcards FROM authenticated;
GRANT SELECT ON TABLE public.user_special_flashcards TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_attention_areas_institution
  ON public.user_attention_areas(user_id, institution_id)
  WHERE institution_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_attention_areas_general
  ON public.user_attention_areas(user_id)
  WHERE institution_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_attention_areas_list
  ON public.user_attention_areas(user_id, list_id);

ALTER TABLE public.user_attention_areas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_attention_areas FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.user_attention_areas TO authenticated;
GRANT ALL ON TABLE public.user_attention_areas TO service_role;

DROP POLICY IF EXISTS "Users can view own attention areas" ON public.user_attention_areas;
CREATE POLICY "Users can view own attention areas"
ON public.user_attention_areas
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_attention_areas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_attention_areas_updated_at ON public.user_attention_areas;
CREATE TRIGGER trg_user_attention_areas_updated_at
BEFORE UPDATE ON public.user_attention_areas
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_attention_areas_updated_at();

-- Older import RPCs still remove a queue row directly after applying an
-- explanation. The trigger keeps that legacy path safe: deleting a canonical
-- row can only retire its derived clone group, never its source group.
CREATE OR REPLACE FUNCTION public.cleanup_user_attention_materialization_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.materialization_group_id IS NULL THEN
    RETURN OLD;
  END IF;

      DELETE FROM public.flashcard_progress p
      USING public.flashcards c
      WHERE p.user_id = OLD.user_id
        AND p.list_id = OLD.materialization_list_id
        AND p.flashcard_id = c.id
        AND c.user_id = OLD.user_id
        AND c.list_id = OLD.materialization_list_id
        AND (
          c.id = OLD.materialization_group_id
          OR c.parent_card_id = OLD.materialization_group_id
    );

  UPDATE public.flashcards c
  SET deleted_at = COALESCE(c.deleted_at, now()), updated_at = now()
  WHERE c.user_id = OLD.user_id
    AND c.list_id = OLD.materialization_list_id
    AND (
      c.id = OLD.materialization_group_id
      OR c.parent_card_id = OLD.materialization_group_id
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_user_attention_materialization ON public.user_special_flashcards;
CREATE TRIGGER trg_cleanup_user_attention_materialization
AFTER DELETE ON public.user_special_flashcards
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_user_attention_materialization_on_delete();

CREATE OR REPLACE FUNCTION public.set_user_attention_point(
  _flashcard_id uuid,
  _enabled boolean,
  _institution_id uuid DEFAULT NULL,
  _focus jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_source public.flashcards%ROWTYPE;
  v_root public.flashcards%ROWTYPE;
  v_list public.lists%ROWTYPE;
  v_folder public.folders%ROWTYPE;
  v_area public.user_attention_areas%ROWTYPE;
  v_point public.user_special_flashcards%ROWTYPE;
  v_requested_group_id uuid;
  v_canonical_source_card_id uuid;
  v_source_list_id uuid;
  v_source_group_id uuid;
  v_clone_group_id uuid;
  v_source_count bigint;
  v_clone_count bigint;
  v_clone_layer_ids jsonb := '[]'::jsonb;
  v_focus_text text;
  v_focus_side text;
  v_focus_tag text;
  v_focus_note text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_source
  FROM public.flashcards
  WHERE id = _flashcard_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card original não encontrado.' USING ERRCODE = '42501';
  END IF;

  IF v_source.list_id IS NOT NULL THEN
    SELECT l.*
    INTO v_list
    FROM public.lists l
    WHERE l.id = v_source.list_id
      AND l.deleted_at IS NULL;

    SELECT f.*
    INTO v_folder
    FROM public.folders f
    WHERE f.id = v_list.folder_id
      AND f.deleted_at IS NULL;
  END IF;
  v_canonical_source_card_id := _flashcard_id;
  v_source_list_id := v_source.list_id;

  -- A point may be created for an owned card or for a card the user can study.
  -- The clone itself is always private and owned by the authenticated user.
  IF v_source.user_id IS DISTINCT FROM v_uid THEN
    IF v_source.list_id IS NULL OR v_list.id IS NULL OR v_folder.id IS NULL THEN
      RAISE EXCEPTION 'Você não tem permissão para marcar este card.' USING ERRCODE = '42501';
    END IF;

    IF NOT (
      v_list.owner_id = v_uid
      OR v_folder.owner_id = v_uid
      OR v_list.visibility = 'public'
      OR v_folder.visibility = 'public'
      OR (
        v_list.visibility = 'class'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = v_list.owner_id
            AND COALESCE(p.public_access_enabled, false) = true
        )
      )
      OR (
        v_folder.visibility = 'class'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = v_folder.owner_id
            AND COALESCE(p.public_access_enabled, false) = true
        )
      )
      OR (
        v_list.class_id IS NOT NULL
        AND (
          public.is_turma_owner(v_list.class_id, v_uid)
          OR public.is_turma_member(v_list.class_id, v_uid)
        )
      )
      OR (
        v_folder.class_id IS NOT NULL
        AND (
          public.is_turma_owner(v_folder.class_id, v_uid)
          OR public.is_turma_member(v_folder.class_id, v_uid)
        )
      )
    ) THEN
      RAISE EXCEPTION 'Você não tem permissão para marcar este card.' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_requested_group_id := COALESCE(v_source.status_group_uid, v_source.parent_card_id, v_source.id);

  -- Studying the automatic area must use the exact same toggle. Resolve a
  -- materialized clone back to its canonical source point before any ON/OFF
  -- decision is made.
  SELECT *
  INTO v_point
  FROM public.user_special_flashcards s
  WHERE s.user_id = v_uid
    AND s.is_active = true
    AND s.materialization_group_id = v_requested_group_id
  ORDER BY s.created_at ASC, s.id ASC
  LIMIT 1
  FOR UPDATE;

  v_source_group_id := COALESCE(v_point.source_group_id, v_requested_group_id);
  IF v_point.source_group_id IS NOT NULL THEN
    v_canonical_source_card_id := v_point.flashcard_id;
    SELECT f.list_id
    INTO v_source_list_id
    FROM public.flashcards f
    WHERE f.id = v_point.flashcard_id;
    v_source_list_id := COALESCE(v_source_list_id, v_point.list_id);
  END IF;

  SELECT *
  INTO v_root
  FROM public.flashcards
  WHERE id = v_source_group_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_root.parent_card_id IS NOT NULL THEN
    RAISE EXCEPTION 'Grupo original inválido.' USING ERRCODE = '22023';
  END IF;

  -- Serialize the same user's operations for this source group. This makes
  -- double taps and two tabs converge on the requested final state.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':attention:' || v_source_group_id::text, 0)
  );

  SELECT *
  INTO v_point
  FROM public.user_special_flashcards s
  WHERE s.user_id = v_uid
    AND s.source_group_id = v_source_group_id
  ORDER BY s.is_active DESC, s.created_at ASC, s.id ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- This fallback makes the migration safe if a legacy row was created while
    -- the backfill was running and also keeps repeated OFF calls harmless.
    SELECT *
    INTO v_point
    FROM public.user_special_flashcards s
    WHERE s.user_id = v_uid
      AND s.flashcard_id = _flashcard_id
    ORDER BY s.is_active DESC, s.created_at ASC, s.id ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT _enabled THEN
    IF v_point.id IS NOT NULL THEN
      IF v_point.materialization_group_id IS NOT NULL THEN
        DELETE FROM public.flashcard_progress p
        USING public.flashcards c
        WHERE p.user_id = v_uid
          AND p.list_id = v_point.materialization_list_id
          AND p.flashcard_id = c.id
          AND c.user_id = v_uid
          AND c.list_id = v_point.materialization_list_id
          AND (
            c.id = v_point.materialization_group_id
            OR c.parent_card_id = v_point.materialization_group_id
          );

        UPDATE public.flashcards c
        SET deleted_at = COALESCE(c.deleted_at, now()),
            updated_at = now()
        WHERE c.user_id = v_uid
          AND c.list_id = v_point.materialization_list_id
          AND (
            c.id = v_point.materialization_group_id
            OR c.parent_card_id = v_point.materialization_group_id
          );
      END IF;

      UPDATE public.user_special_flashcards
      SET is_active = false,
          deactivated_at = now(),
          updated_at = now()
      WHERE id = v_point.id;
    END IF;

    RETURN jsonb_build_object(
      'enabled', false,
      'source_card_id', _flashcard_id,
      'source_group_id', v_source_group_id,
      'point_id', CASE WHEN v_point.id IS NULL THEN NULL ELSE v_point.id END,
      'materialization_group_id', NULL,
      'materialization_list_id', CASE WHEN v_point.id IS NULL THEN NULL ELSE v_point.materialization_list_id END
    );
  END IF;

  IF _institution_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.institutions i
       WHERE i.id = _institution_id
         AND i.owner_id = v_uid
     ) THEN
    RAISE EXCEPTION 'Instituição inválida para esta conta.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':attention-area:' || COALESCE(_institution_id::text, 'general'), 0)
  );

  -- An already active point keeps its original automatic area. This prevents
  -- editing focus from silently moving a clone to another institution.
  IF v_point.id IS NOT NULL
     AND v_point.is_active = true
     AND v_point.attention_area_id IS NOT NULL THEN
    SELECT *
    INTO v_area
    FROM public.user_attention_areas a
    WHERE a.id = v_point.attention_area_id
      AND a.user_id = v_uid
    FOR UPDATE;
  END IF;

  IF v_area.id IS NULL THEN
    SELECT *
    INTO v_area
    FROM public.user_attention_areas a
    WHERE a.user_id = v_uid
      AND a.institution_id IS NOT DISTINCT FROM _institution_id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.folders(
      owner_id, title, description, visibility, class_id, institution_id,
      study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled
    ) VALUES (
      v_uid,
      'Pontos de atenção',
      'Área automática dos cards marcados como pontos de atenção.',
      'private',
      NULL,
      _institution_id,
      COALESCE(v_list.study_type, 'language'),
      v_list.lang_a,
      v_list.lang_b,
      v_list.labels_a,
      v_list.labels_b,
      COALESCE(v_list.tts_enabled, true)
    )
    RETURNING * INTO v_folder;

    INSERT INTO public.lists(
      folder_id, owner_id, title, description, order_index, visibility,
      class_id, institution_id, study_type, lang, lang_a, lang_b,
      labels_a, labels_b, tts_enabled, primary_side
    ) VALUES (
      v_folder.id,
      v_uid,
      'Pontos de atenção',
      'Cards marcados como pontos de atenção.',
      0,
      'private',
      NULL,
      _institution_id,
      COALESCE(v_list.study_type, 'language'),
      v_list.lang,
      v_list.lang_a,
      v_list.lang_b,
      v_list.labels_a,
      v_list.labels_b,
      COALESCE(v_list.tts_enabled, true),
      COALESCE(v_list.primary_side, 'a')
    )
    RETURNING * INTO v_list;

    INSERT INTO public.user_attention_areas(user_id, institution_id, folder_id, list_id)
    VALUES (v_uid, _institution_id, v_folder.id, v_list.id)
    RETURNING * INTO v_area;
  END IF;

  -- Reuse only a complete, live materialization. Any partial/old clone is
  -- retired as a whole before a fresh clone is created.
  IF v_point.id IS NOT NULL
     AND v_point.is_active = true
     AND v_point.materialization_group_id IS NOT NULL
     AND v_point.materialization_list_id IS NOT NULL THEN
    SELECT count(*)
    INTO v_source_count
    FROM public.flashcards c
    WHERE c.deleted_at IS NULL
      AND (c.id = v_source_group_id OR c.parent_card_id = v_source_group_id);

    SELECT count(*)
    INTO v_clone_count
    FROM public.flashcards c
    WHERE c.deleted_at IS NULL
      AND c.user_id = v_uid
      AND c.list_id = v_point.materialization_list_id
      AND (c.id = v_point.materialization_group_id OR c.parent_card_id = v_point.materialization_group_id);

    IF v_source_count = v_clone_count
       AND v_clone_count > 0
       AND NOT EXISTS (
         SELECT 1
         FROM (
           SELECT
             c.layer_index,
             row_number() OVER (
               ORDER BY COALESCE(c.layer_index, 2147483647), c.created_at, c.id
             ) - 1 AS expected_layer_index
           FROM public.flashcards c
           WHERE c.parent_card_id = v_point.materialization_group_id
             AND c.deleted_at IS NULL
         ) ordered_clone_layers
         WHERE ordered_clone_layers.layer_index IS DISTINCT FROM ordered_clone_layers.expected_layer_index
       ) THEN
      v_clone_group_id := v_point.materialization_group_id;
    ELSE
      DELETE FROM public.flashcard_progress p
      USING public.flashcards c
      WHERE p.user_id = v_uid
        AND p.list_id = v_point.materialization_list_id
        AND p.flashcard_id = c.id
        AND c.user_id = v_uid
        AND c.list_id = v_point.materialization_list_id
        AND (c.id = v_point.materialization_group_id OR c.parent_card_id = v_point.materialization_group_id);

      UPDATE public.flashcards c
      SET deleted_at = COALESCE(c.deleted_at, now()), updated_at = now()
      WHERE c.user_id = v_uid
        AND c.list_id = v_point.materialization_list_id
        AND (c.id = v_point.materialization_group_id OR c.parent_card_id = v_point.materialization_group_id);
    END IF;
  END IF;

  IF v_clone_group_id IS NULL THEN
    INSERT INTO public.flashcards(
      collection_id, list_id, user_id, term, translation, hint, context_tag,
      example_text, example_translation, detailed_explanation, usage_notes,
      common_mistakes, short_explanation, audio_url, image_url_a, image_url_b,
      lang, display_text, eval_text, note_text, word_hints,
      accepted_answers_en, accepted_answers_pt, parent_card_id, layer_index
    )
    SELECT
      NULL, v_area.list_id, v_uid, c.term, c.translation, c.hint, c.context_tag,
      c.example_text, c.example_translation, c.detailed_explanation, c.usage_notes,
      c.common_mistakes, c.short_explanation, c.audio_url, c.image_url_a, c.image_url_b,
      c.lang, c.display_text, c.eval_text, c.note_text, c.word_hints,
      c.accepted_answers_en, c.accepted_answers_pt, NULL, NULL
    FROM public.flashcards c
    WHERE c.id = v_source_group_id
      AND c.deleted_at IS NULL
    RETURNING id INTO v_clone_group_id;

    IF v_clone_group_id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível materializar o card original.';
    END IF;

    INSERT INTO public.flashcards(
      collection_id, list_id, user_id, term, translation, hint, context_tag,
      example_text, example_translation, detailed_explanation, usage_notes,
      common_mistakes, short_explanation, audio_url, image_url_a, image_url_b,
      lang, display_text, eval_text, note_text, word_hints,
      accepted_answers_en, accepted_answers_pt, parent_card_id, layer_index
    )
    SELECT
      NULL, v_area.list_id, v_uid, c.term, c.translation, c.hint, c.context_tag,
      c.example_text, c.example_translation, c.detailed_explanation, c.usage_notes,
      c.common_mistakes, c.short_explanation, c.audio_url, c.image_url_a, c.image_url_b,
      c.lang, c.display_text, c.eval_text, c.note_text, c.word_hints,
      c.accepted_answers_en, c.accepted_answers_pt, v_clone_group_id,
      row_number() OVER (ORDER BY COALESCE(c.layer_index, 2147483647), c.created_at, c.id) - 1
    FROM public.flashcards c
    WHERE c.parent_card_id = v_source_group_id
      AND c.deleted_at IS NULL;

    SELECT COALESCE(
      jsonb_agg(c.id ORDER BY COALESCE(c.layer_index, 2147483647), c.created_at, c.id),
      '[]'::jsonb
    )
    INTO v_clone_layer_ids
    FROM public.flashcards c
    WHERE c.parent_card_id = v_clone_group_id
      AND c.deleted_at IS NULL;
  END IF;

  IF v_point.id IS NULL THEN
    v_focus_text := CASE WHEN _focus ? 'focus_text' THEN NULLIF(BTRIM(_focus->>'focus_text'), '') END;
    v_focus_side := CASE WHEN _focus ? 'focus_side' THEN NULLIF(BTRIM(_focus->>'focus_side'), '') END;
    v_focus_tag := CASE WHEN _focus ? 'focus_tag' THEN NULLIF(BTRIM(_focus->>'focus_tag'), '') END;
    v_focus_note := CASE WHEN _focus ? 'focus_note' THEN NULLIF(BTRIM(_focus->>'focus_note'), '') END;

    INSERT INTO public.user_special_flashcards(
      user_id, flashcard_id, list_id, focus_text, focus_side, focus_tag, focus_note,
      source_group_id, attention_area_id, materialization_list_id,
      materialization_group_id, is_active, deactivated_at
    ) VALUES (
      v_uid, v_canonical_source_card_id, v_source_list_id, v_focus_text, v_focus_side, v_focus_tag, v_focus_note,
      v_source_group_id, v_area.id, v_area.list_id, v_clone_group_id, true, NULL
    )
    RETURNING * INTO v_point;
  ELSE
    UPDATE public.user_special_flashcards
    SET flashcard_id = v_canonical_source_card_id,
        list_id = v_source_list_id,
        source_group_id = v_source_group_id,
        attention_area_id = v_area.id,
        materialization_list_id = v_area.list_id,
        materialization_group_id = v_clone_group_id,
        is_active = true,
        deactivated_at = NULL,
        focus_text = CASE WHEN _focus IS NULL THEN focus_text ELSE NULLIF(BTRIM(_focus->>'focus_text'), '') END,
        focus_side = CASE WHEN _focus IS NULL THEN focus_side ELSE NULLIF(BTRIM(_focus->>'focus_side'), '') END,
        focus_tag = CASE WHEN _focus IS NULL THEN focus_tag ELSE NULLIF(BTRIM(_focus->>'focus_tag'), '') END,
        focus_note = CASE WHEN _focus IS NULL THEN focus_note ELSE NULLIF(BTRIM(_focus->>'focus_note'), '') END,
        updated_at = now()
    WHERE id = v_point.id
    RETURNING * INTO v_point;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'source_card_id', _flashcard_id,
    'source_group_id', v_source_group_id,
    'point_id', v_point.id,
    'attention_area_id', v_area.id,
    'area_folder_id', v_area.folder_id,
    'area_list_id', v_area.list_id,
    'materialization_group_id', v_clone_group_id,
    'materialization_list_id', v_area.list_id,
    'materialization_layer_ids', v_clone_layer_ids
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_attention_points(
  _flashcard_ids uuid[],
  _enabled boolean,
  _institution_id uuid DEFAULT NULL,
  _focus jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_card_id uuid;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF _flashcard_ids IS NULL OR cardinality(_flashcard_ids) = 0 THEN
    RETURN jsonb_build_object('enabled', _enabled, 'items', v_items, 'count', 0);
  END IF;

  FOREACH v_card_id IN ARRAY _flashcard_ids LOOP
    v_items := v_items || jsonb_build_array(
      public.set_user_attention_point(v_card_id, _enabled, _institution_id, _focus)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'enabled', _enabled,
    'items', v_items,
    'count', jsonb_array_length(v_items)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_attention_point(uuid, boolean, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_attention_point(uuid, boolean, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.set_user_attention_points(uuid[], boolean, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_attention_points(uuid[], boolean, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.set_user_attention_point(uuid, boolean, uuid, jsonb) IS
  'Canonical reversible ON/OFF mutation for Points of attention. It never mutates the source card and materializes a fresh private group on each new activation.';

NOTIFY pgrst, 'reload schema';
COMMIT;
