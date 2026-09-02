BEGIN;

-- Domain boundary:
--   attention_points = granular focus/AI export queue;
--   reinforcement = private, complete study materialization.
-- The previous migration is intentionally kept intact for history. This
-- additive migration changes the live RPC contract and preserves ambiguous
-- legacy attention materializations instead of deleting them.

-- Recovery preflight: the focus migration may have been pasted manually and
-- stopped before its first ALTER was committed. Keep this migration runnable
-- from that partially-applied state as well as from the normal migration chain.
ALTER TABLE public.user_special_flashcards
  ADD COLUMN IF NOT EXISTS source_group_id uuid,
  ADD COLUMN IF NOT EXISTS attention_area_id uuid,
  ADD COLUMN IF NOT EXISTS materialization_list_id uuid,
  ADD COLUMN IF NOT EXISTS materialization_group_id uuid,
  ADD COLUMN IF NOT EXISTS focus_text text,
  ADD COLUMN IF NOT EXISTS focus_side text,
  ADD COLUMN IF NOT EXISTS focus_tag text,
  ADD COLUMN IF NOT EXISTS focus_note text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
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
USING ((select auth.uid()) = user_id);

-- Stable attention identity and canonical idempotency. Historical duplicate
-- rows are retained as inactive history; no legacy clone is deleted here.
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
UPDATE public.user_special_flashcards s
SET is_active = false,
    deactivated_at = COALESCE(s.deactivated_at, now()),
    updated_at = now()
FROM ranked r
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

REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_special_flashcards FROM authenticated;
GRANT SELECT ON TABLE public.user_special_flashcards TO authenticated;

-- The previous attention implementation attached a DELETE trigger that
-- removed legacy clones. New attention removals are soft state changes, and
-- ambiguous historical materializations must remain preserved.
DROP TRIGGER IF EXISTS trg_cleanup_user_attention_materialization
  ON public.user_special_flashcards;

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS system_kind text NOT NULL DEFAULT 'user';

ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS system_kind text NOT NULL DEFAULT 'user';

ALTER TABLE public.folders
  DROP CONSTRAINT IF EXISTS folders_system_kind_check;

ALTER TABLE public.folders
  ADD CONSTRAINT folders_system_kind_check
  CHECK (system_kind IN ('user', 'attention_points', 'reinforcement'));

ALTER TABLE public.lists
  DROP CONSTRAINT IF EXISTS lists_system_kind_check;

ALTER TABLE public.lists
  ADD CONSTRAINT lists_system_kind_check
  CHECK (system_kind IN ('user', 'attention_points', 'reinforcement'));

-- source_group_id stores flashcards.status_group_uid. That identity is stable
-- but is not guaranteed to equal a flashcards.id after the stable-identity
-- migration, so the old FK was semantically invalid and is removed.
ALTER TABLE public.user_special_flashcards
  DROP CONSTRAINT IF EXISTS user_special_flashcards_source_group_id_fkey;

UPDATE public.folders f
SET system_kind = 'attention_points'
FROM public.user_attention_areas a
WHERE a.folder_id = f.id
  AND f.system_kind = 'user';

UPDATE public.lists l
SET system_kind = 'attention_points'
FROM public.user_attention_areas a
WHERE a.list_id = l.id
  AND l.system_kind = 'user';

CREATE TABLE IF NOT EXISTS public.user_reinforcement_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_reinforcement_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  source_card_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  source_group_uid uuid NOT NULL,
  source_list_id uuid REFERENCES public.lists(id) ON DELETE SET NULL,
  materialization_list_id uuid REFERENCES public.lists(id) ON DELETE SET NULL,
  materialization_group_id uuid REFERENCES public.flashcards(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_reinforcement_area_institution
  ON public.user_reinforcement_areas(user_id, institution_id)
  WHERE institution_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_reinforcement_area_general
  ON public.user_reinforcement_areas(user_id)
  WHERE institution_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_reinforcement_areas_list
  ON public.user_reinforcement_areas(user_id, list_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_reinforcement_active_institution_group
  ON public.user_reinforcement_points(user_id, institution_id, source_group_uid)
  WHERE institution_id IS NOT NULL AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_reinforcement_active_general_group
  ON public.user_reinforcement_points(user_id, source_group_uid)
  WHERE institution_id IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_reinforcement_active_list
  ON public.user_reinforcement_points(user_id, institution_id, materialization_list_id)
  WHERE is_active = true;

ALTER TABLE public.user_reinforcement_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reinforcement_points ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_reinforcement_areas FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_reinforcement_areas FROM authenticated;
GRANT SELECT ON TABLE public.user_reinforcement_areas TO authenticated;
GRANT ALL ON TABLE public.user_reinforcement_areas TO service_role;

REVOKE ALL ON TABLE public.user_reinforcement_points FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_reinforcement_points FROM authenticated;
GRANT SELECT ON TABLE public.user_reinforcement_points TO authenticated;
GRANT ALL ON TABLE public.user_reinforcement_points TO service_role;

DROP POLICY IF EXISTS "Users can view own reinforcement areas" ON public.user_reinforcement_areas;
CREATE POLICY "Users can view own reinforcement areas"
ON public.user_reinforcement_areas
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own reinforcement points" ON public.user_reinforcement_points;
CREATE POLICY "Users can view own reinforcement points"
ON public.user_reinforcement_points
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_reinforcement_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_reinforcement_areas_updated_at ON public.user_reinforcement_areas;
CREATE TRIGGER trg_user_reinforcement_areas_updated_at
BEFORE UPDATE ON public.user_reinforcement_areas
FOR EACH ROW EXECUTE FUNCTION public.touch_user_reinforcement_updated_at();

DROP TRIGGER IF EXISTS trg_user_reinforcement_points_updated_at ON public.user_reinforcement_points;
CREATE TRIGGER trg_user_reinforcement_points_updated_at
BEFORE UPDATE ON public.user_reinforcement_points
FOR EACH ROW EXECUTE FUNCTION public.touch_user_reinforcement_updated_at();

-- System collections are immutable to the client. The RPCs below run as the
-- function owner and remain able to create/retire their own materializations.
CREATE OR REPLACE FUNCTION public.prevent_system_collection_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user = 'service_role'
     OR (
       current_user = 'postgres'
       AND current_setting('app.allow_system_collection_mutation', true) = 'on'
     ) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.system_kind, 'user') <> 'user' THEN
      RAISE EXCEPTION 'Coleção automática é somente leitura.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.system_kind, 'user') <> 'user' THEN
      RAISE EXCEPTION 'Coleção automática é somente leitura.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF COALESCE(OLD.system_kind, 'user') <> 'user'
     OR COALESCE(NEW.system_kind, 'user') <> 'user' THEN
    RAISE EXCEPTION 'Coleção automática é somente leitura.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_folders_system_collection_readonly ON public.folders;
CREATE TRIGGER trg_folders_system_collection_readonly
BEFORE INSERT OR UPDATE OR DELETE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.prevent_system_collection_mutation();

DROP TRIGGER IF EXISTS trg_lists_system_collection_readonly ON public.lists;
CREATE TRIGGER trg_lists_system_collection_readonly
BEFORE INSERT OR UPDATE OR DELETE ON public.lists
FOR EACH ROW EXECUTE FUNCTION public.prevent_system_collection_mutation();

CREATE OR REPLACE FUNCTION public.prevent_system_flashcard_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_kind text;
  v_new_kind text;
  v_old_list_id uuid;
  v_new_list_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_list_id := OLD.list_id;
    SELECT system_kind INTO v_old_kind
    FROM public.lists
    WHERE id = v_old_list_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_new_list_id := NEW.list_id;
    SELECT system_kind INTO v_new_kind
    FROM public.lists
    WHERE id = v_new_list_id;
  END IF;

  IF (
       COALESCE(v_old_kind, 'user') <> 'user'
       OR COALESCE(v_new_kind, 'user') <> 'user'
     )
     AND NOT (
       current_user = 'service_role'
       OR (
         current_user = 'postgres'
         AND current_setting('app.allow_system_collection_mutation', true) = 'on'
       )
     ) THEN
    RAISE EXCEPTION 'Cards de coleção automática são somente leitura.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flashcards_system_collection_readonly ON public.flashcards;
CREATE TRIGGER trg_flashcards_system_collection_readonly
BEFORE INSERT OR UPDATE OR DELETE ON public.flashcards
FOR EACH ROW EXECUTE FUNCTION public.prevent_system_flashcard_mutation();

-- New attention behavior: keep the existing export/import row and focus data,
-- but never create, reuse, edit, or delete a study clone.
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
  v_list public.lists%ROWTYPE;
  v_folder public.folders%ROWTYPE;
  v_area public.user_attention_areas%ROWTYPE;
  v_point public.user_special_flashcards%ROWTYPE;
  v_group_uid uuid;
  v_focus_text text;
  v_focus_side text;
  v_focus_tag text;
  v_focus_note text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.allow_system_collection_mutation', 'on', true);

  SELECT * INTO v_source
  FROM public.flashcards
  WHERE id = _flashcard_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card original não encontrado.' USING ERRCODE = '42501';
  END IF;

  IF v_source.list_id IS NOT NULL THEN
    SELECT * INTO v_list FROM public.lists
    WHERE id = v_source.list_id AND deleted_at IS NULL;
    SELECT * INTO v_folder FROM public.folders
    WHERE id = v_list.folder_id AND deleted_at IS NULL;
  END IF;

  IF v_source.list_id IS NULL
     OR v_list.id IS NULL
     OR v_folder.id IS NULL
     OR v_list.institution_id IS DISTINCT FROM _institution_id THEN
    RAISE EXCEPTION 'O card não pertence à instituição selecionada.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_list.system_kind, 'user') <> 'user' THEN
    RAISE EXCEPTION 'A coleção automática é somente leitura.' USING ERRCODE = '42501';
  END IF;

  IF v_source.user_id IS DISTINCT FROM v_uid
     AND NOT (
       v_list.owner_id = v_uid
       OR v_folder.owner_id = v_uid
       OR v_list.visibility = 'public'
       OR v_folder.visibility = 'public'
       OR (
         v_list.class_id IS NOT NULL
         AND (public.is_turma_owner(v_list.class_id, v_uid)
              OR public.is_turma_member(v_list.class_id, v_uid))
       )
       OR (
         v_folder.class_id IS NOT NULL
         AND (public.is_turma_owner(v_folder.class_id, v_uid)
              OR public.is_turma_member(v_folder.class_id, v_uid))
       )
     ) THEN
    RAISE EXCEPTION 'Você não tem permissão para marcar este card.' USING ERRCODE = '42501';
  END IF;

  v_group_uid := COALESCE(v_source.status_group_uid, v_source.parent_card_id, v_source.id);
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':attention:' || v_group_uid::text, 0)
  );

  SELECT * INTO v_point
  FROM public.user_special_flashcards s
  WHERE s.user_id = v_uid
    AND (s.source_group_id = v_group_uid OR s.flashcard_id = _flashcard_id)
  ORDER BY s.is_active DESC, s.created_at ASC, s.id ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT _enabled THEN
    IF v_point.id IS NOT NULL THEN
      UPDATE public.user_special_flashcards
      SET is_active = false, deactivated_at = now(), updated_at = now()
      WHERE id = v_point.id;
    END IF;
    RETURN jsonb_build_object(
      'enabled', false,
      'source_card_id', _flashcard_id,
      'source_group_id', v_group_uid,
      'point_id', CASE WHEN v_point.id IS NULL THEN NULL ELSE v_point.id END,
      'materialization_group_id', NULL,
      'materialization_list_id', NULL
    );
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':attention-area:' || COALESCE(_institution_id::text, 'general'), 0)
  );

  IF v_point.id IS NOT NULL AND v_point.attention_area_id IS NOT NULL THEN
    SELECT * INTO v_area
    FROM public.user_attention_areas a
    WHERE a.id = v_point.attention_area_id AND a.user_id = v_uid
    FOR UPDATE;
    IF v_area.id IS NOT NULL
       AND v_area.institution_id IS DISTINCT FROM _institution_id THEN
      v_area := NULL;
    END IF;
  END IF;

  IF v_area.id IS NULL THEN
    SELECT * INTO v_area
    FROM public.user_attention_areas a
    WHERE a.user_id = v_uid
      AND a.institution_id IS NOT DISTINCT FROM _institution_id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_area.id IS NULL THEN
    INSERT INTO public.folders(
      owner_id, title, description, visibility, institution_id,
      study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, system_kind
    ) VALUES (
      v_uid, 'Pontos de atenção',
      'Área de foco, análise e exportação para IA.', 'private', _institution_id,
      v_folder.study_type, v_folder.lang_a, v_folder.lang_b,
      v_folder.labels_a, v_folder.labels_b, COALESCE(v_folder.tts_enabled, true),
      'attention_points'
    ) RETURNING * INTO v_folder;

    INSERT INTO public.lists(
      folder_id, owner_id, title, description, order_index, visibility,
      institution_id, study_type, lang, lang_a, lang_b, labels_a, labels_b,
      tts_enabled, primary_side, system_kind
    ) VALUES (
      v_folder.id, v_uid, 'Pontos de atenção',
      'Foco específico, notas e exportação para IA.', 0, 'private',
      _institution_id, v_folder.study_type, v_folder.lang_a, v_folder.lang_a,
      v_folder.lang_b, v_folder.labels_a, v_folder.labels_b,
      COALESCE(v_folder.tts_enabled, true), 'a', 'attention_points'
    ) RETURNING id INTO v_area.list_id;

    INSERT INTO public.user_attention_areas(user_id, institution_id, folder_id, list_id)
    VALUES (v_uid, _institution_id, v_folder.id, v_area.list_id)
    RETURNING * INTO v_area;
  END IF;

  v_focus_text := CASE WHEN _focus ? 'focus_text' THEN NULLIF(BTRIM(_focus->>'focus_text'), '') END;
  v_focus_side := CASE WHEN _focus ? 'focus_side' THEN NULLIF(BTRIM(_focus->>'focus_side'), '') END;
  v_focus_tag := CASE WHEN _focus ? 'focus_tag' THEN NULLIF(BTRIM(_focus->>'focus_tag'), '') END;
  v_focus_note := CASE WHEN _focus ? 'focus_note' THEN NULLIF(BTRIM(_focus->>'focus_note'), '') END;

  IF v_point.id IS NULL THEN
    INSERT INTO public.user_special_flashcards(
      user_id, flashcard_id, list_id, focus_text, focus_side, focus_tag, focus_note,
      source_group_id, attention_area_id, materialization_list_id,
      materialization_group_id, is_active, deactivated_at
    ) VALUES (
      v_uid, _flashcard_id, v_source.list_id, v_focus_text, v_focus_side,
      v_focus_tag, v_focus_note, v_group_uid, v_area.id, NULL, NULL, true, NULL
    ) RETURNING * INTO v_point;
  ELSE
    UPDATE public.user_special_flashcards
    SET flashcard_id = _flashcard_id,
        list_id = v_source.list_id,
        source_group_id = v_group_uid,
        attention_area_id = v_area.id,
        materialization_list_id = NULL,
        materialization_group_id = NULL,
        is_active = true,
        deactivated_at = NULL,
        focus_text = v_focus_text,
        focus_side = v_focus_side,
        focus_tag = v_focus_tag,
        focus_note = v_focus_note,
        updated_at = now()
    WHERE id = v_point.id
    RETURNING * INTO v_point;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'source_card_id', _flashcard_id,
    'source_group_id', v_group_uid,
    'point_id', v_point.id,
    'attention_area_id', v_area.id,
    'area_folder_id', v_area.folder_id,
    'area_list_id', v_area.list_id,
    'materialization_group_id', NULL,
    'materialization_list_id', NULL
  );
END;
$$;

-- Full-group clone used only by the Reforço mutation. It copies the root and
-- every direct layer, preserving all study/content fields and layer_index.
CREATE OR REPLACE FUNCTION public.set_user_reinforcement_point(
  _flashcard_id uuid,
  _enabled boolean,
  _institution_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_source public.flashcards%ROWTYPE;
  v_source_root public.flashcards%ROWTYPE;
  v_list public.lists%ROWTYPE;
  v_folder public.folders%ROWTYPE;
  v_area public.user_reinforcement_areas%ROWTYPE;
  v_entry public.user_reinforcement_points%ROWTYPE;
  v_group_uid uuid;
  v_source_list_id uuid;
  v_clone_group_id uuid;
  v_source_count bigint;
  v_clone_count bigint;
  v_layer_ids jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.allow_system_collection_mutation', 'on', true);

  -- A study session inside Reforço sends the materialized card id. Resolve it
  -- back to the canonical source before any institution or ON/OFF decision.
  SELECT p.* INTO v_entry
  FROM public.user_reinforcement_points p
  JOIN public.flashcards c ON c.id = _flashcard_id
  WHERE p.user_id = v_uid
    AND p.is_active = true
    AND (c.id = p.materialization_group_id OR c.parent_card_id = p.materialization_group_id)
  ORDER BY p.updated_at DESC, p.id ASC
  LIMIT 1;

  IF v_entry.id IS NOT NULL THEN
    SELECT * INTO v_source
    FROM public.flashcards
    WHERE id = v_entry.source_card_id AND deleted_at IS NULL;
    v_group_uid := v_entry.source_group_uid;
    v_source_list_id := v_entry.source_list_id;
  ELSE
    SELECT * INTO v_source
    FROM public.flashcards
    WHERE id = _flashcard_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Card original não encontrado.' USING ERRCODE = '42501';
    END IF;
    v_group_uid := COALESCE(v_source.status_group_uid, v_source.parent_card_id, v_source.id);
    v_source_list_id := v_source.list_id;
  END IF;

  IF v_source_list_id IS NULL THEN
    RAISE EXCEPTION 'Reforço exige um card pertencente a uma lista.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_list FROM public.lists
  WHERE id = v_source_list_id AND deleted_at IS NULL;
  SELECT * INTO v_folder FROM public.folders
  WHERE id = v_list.folder_id AND deleted_at IS NULL;

  IF v_list.id IS NULL OR v_folder.id IS NULL
     OR v_list.institution_id IS DISTINCT FROM _institution_id THEN
    RAISE EXCEPTION 'O card não pertence à instituição selecionada.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_list.system_kind, 'user') <> 'user' THEN
    RAISE EXCEPTION 'A coleção automática é somente leitura.' USING ERRCODE = '42501';
  END IF;

  IF v_source.user_id IS DISTINCT FROM v_uid
     AND NOT (
       v_list.owner_id = v_uid
       OR v_folder.owner_id = v_uid
       OR v_list.visibility = 'public'
       OR v_folder.visibility = 'public'
       OR (
         v_list.class_id IS NOT NULL
         AND (public.is_turma_owner(v_list.class_id, v_uid)
              OR public.is_turma_member(v_list.class_id, v_uid))
       )
       OR (
         v_folder.class_id IS NOT NULL
         AND (public.is_turma_owner(v_folder.class_id, v_uid)
              OR public.is_turma_member(v_folder.class_id, v_uid))
       )
     ) THEN
    RAISE EXCEPTION 'Você não tem permissão para adicionar este card ao Reforço.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':reinforcement:' ||
      COALESCE(_institution_id::text, 'general') || ':' || v_group_uid::text, 0)
  );

  SELECT * INTO v_entry
  FROM public.user_reinforcement_points p
  WHERE p.user_id = v_uid
    AND p.institution_id IS NOT DISTINCT FROM _institution_id
    AND p.source_group_uid = v_group_uid
  ORDER BY p.is_active DESC, p.updated_at DESC, p.id ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT _enabled THEN
    IF v_entry.id IS NOT NULL THEN
      IF v_entry.materialization_group_id IS NOT NULL
         AND v_entry.materialization_list_id IS NOT NULL THEN
        DELETE FROM public.flashcard_progress p
        USING public.flashcards c
        WHERE p.user_id = v_uid
          AND p.list_id = v_entry.materialization_list_id
          AND p.flashcard_id = c.id
          AND c.user_id = v_uid
          AND c.list_id = v_entry.materialization_list_id
          AND (c.id = v_entry.materialization_group_id
               OR c.parent_card_id = v_entry.materialization_group_id);

        UPDATE public.flashcards c
        SET deleted_at = COALESCE(c.deleted_at, now()), updated_at = now()
        WHERE c.user_id = v_uid
          AND c.list_id = v_entry.materialization_list_id
          AND (c.id = v_entry.materialization_group_id
               OR c.parent_card_id = v_entry.materialization_group_id);
      END IF;

      UPDATE public.user_reinforcement_points
      SET is_active = false, deactivated_at = now(), updated_at = now()
      WHERE id = v_entry.id;
    END IF;

    RETURN jsonb_build_object(
      'enabled', false,
      'source_card_id', _flashcard_id,
      'source_group_uid', v_group_uid,
      'point_id', CASE WHEN v_entry.id IS NULL THEN NULL ELSE v_entry.id END,
      'materialization_group_id', NULL,
      'materialization_list_id', CASE WHEN v_entry.id IS NULL THEN NULL ELSE v_entry.materialization_list_id END,
      'materialization_layer_ids', '[]'::jsonb
    );
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':reinforcement-area:' || COALESCE(_institution_id::text, 'general'), 0)
  );

  IF v_area.id IS NULL THEN
    SELECT * INTO v_area
    FROM public.user_reinforcement_areas a
    WHERE a.user_id = v_uid
      AND a.institution_id IS NOT DISTINCT FROM _institution_id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_area.id IS NULL THEN
    INSERT INTO public.folders(
      owner_id, title, description, visibility, institution_id,
      study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, system_kind
    ) VALUES (
      v_uid, 'Reforço',
      'Cards adicionados para revisão pessoal. Esta coleção é somente leitura.',
      'private', _institution_id, v_folder.study_type, v_folder.lang_a,
      v_folder.lang_b, v_folder.labels_a, v_folder.labels_b,
      COALESCE(v_folder.tts_enabled, true), 'reinforcement'
    ) RETURNING * INTO v_folder;

    INSERT INTO public.lists(
      folder_id, owner_id, title, description, order_index, visibility,
      institution_id, study_type, lang, lang_a, lang_b, labels_a, labels_b,
      tts_enabled, primary_side, system_kind
    ) VALUES (
      v_folder.id, v_uid, 'Reforço',
      'Coleção automática de revisão pessoal.', 0, 'private', _institution_id,
      v_folder.study_type, v_folder.lang_a, v_folder.lang_a, v_folder.lang_b,
      v_folder.labels_a, v_folder.labels_b, COALESCE(v_folder.tts_enabled, true),
      'a', 'reinforcement'
    ) RETURNING id INTO v_area.list_id;

    INSERT INTO public.user_reinforcement_areas(user_id, institution_id, folder_id, list_id)
    VALUES (v_uid, _institution_id, v_folder.id, v_area.list_id)
    RETURNING * INTO v_area;
  END IF;

  SELECT * INTO v_source_root
  FROM public.flashcards c
  WHERE c.list_id = v_source_list_id
    AND c.deleted_at IS NULL
    AND c.parent_card_id IS NULL
    AND (c.id = v_group_uid OR c.status_group_uid = v_group_uid OR c.id = v_source.id)
  ORDER BY (c.id = v_source.id) DESC, c.created_at ASC, c.id ASC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo original inválido.' USING ERRCODE = '22023';
  END IF;

  IF v_entry.id IS NOT NULL AND v_entry.is_active
     AND v_entry.materialization_group_id IS NOT NULL
     AND v_entry.materialization_list_id IS NOT NULL THEN
    SELECT count(*) INTO v_source_count
    FROM public.flashcards c
    WHERE c.list_id = v_source_list_id AND c.deleted_at IS NULL
      AND (c.id = v_source_root.id OR c.parent_card_id = v_source_root.id);

    SELECT count(*) INTO v_clone_count
    FROM public.flashcards c
    WHERE c.user_id = v_uid AND c.list_id = v_entry.materialization_list_id
      AND c.deleted_at IS NULL
      AND (c.id = v_entry.materialization_group_id OR c.parent_card_id = v_entry.materialization_group_id);

    IF v_source_count = v_clone_count AND v_clone_count > 0 THEN
      v_clone_group_id := v_entry.materialization_group_id;
      SELECT COALESCE(jsonb_agg(c.id ORDER BY c.layer_index NULLS FIRST, c.created_at, c.id), '[]'::jsonb)
      INTO v_layer_ids
      FROM public.flashcards c
      WHERE c.parent_card_id = v_clone_group_id AND c.deleted_at IS NULL;
    ELSE
      DELETE FROM public.flashcard_progress p
      USING public.flashcards c
      WHERE p.user_id = v_uid AND p.list_id = v_entry.materialization_list_id
        AND p.flashcard_id = c.id AND c.user_id = v_uid
        AND (c.id = v_entry.materialization_group_id OR c.parent_card_id = v_entry.materialization_group_id);
      UPDATE public.flashcards c
      SET deleted_at = COALESCE(c.deleted_at, now()), updated_at = now()
      WHERE c.user_id = v_uid AND c.list_id = v_entry.materialization_list_id
        AND (c.id = v_entry.materialization_group_id OR c.parent_card_id = v_entry.materialization_group_id);
    END IF;
  END IF;

  IF v_clone_group_id IS NULL THEN
    INSERT INTO public.flashcards(
      collection_id, list_id, user_id, term, translation, hint, context_tag,
      example_text, example_translation, detailed_explanation, usage_notes,
      common_mistakes, short_explanation, audio_url, image_url_a, image_url_b,
      lang, display_text, eval_text, note_text, word_hints, accepted_answers_en,
      accepted_answers_pt, parent_card_id, layer_index
    )
    SELECT NULL, v_area.list_id, v_uid, c.term, c.translation, c.hint, c.context_tag,
      c.example_text, c.example_translation, c.detailed_explanation, c.usage_notes,
      c.common_mistakes, c.short_explanation, c.audio_url, c.image_url_a, c.image_url_b,
      c.lang, c.display_text, c.eval_text, c.note_text, c.word_hints,
      c.accepted_answers_en, c.accepted_answers_pt, NULL, c.layer_index
    FROM public.flashcards c
    WHERE c.id = v_source_root.id AND c.deleted_at IS NULL
    RETURNING id INTO v_clone_group_id;

    INSERT INTO public.flashcards(
      collection_id, list_id, user_id, term, translation, hint, context_tag,
      example_text, example_translation, detailed_explanation, usage_notes,
      common_mistakes, short_explanation, audio_url, image_url_a, image_url_b,
      lang, display_text, eval_text, note_text, word_hints, accepted_answers_en,
      accepted_answers_pt, parent_card_id, layer_index
    )
    SELECT NULL, v_area.list_id, v_uid, c.term, c.translation, c.hint, c.context_tag,
      c.example_text, c.example_translation, c.detailed_explanation, c.usage_notes,
      c.common_mistakes, c.short_explanation, c.audio_url, c.image_url_a, c.image_url_b,
      c.lang, c.display_text, c.eval_text, c.note_text, c.word_hints,
      c.accepted_answers_en, c.accepted_answers_pt, v_clone_group_id, c.layer_index
    FROM public.flashcards c
    WHERE c.parent_card_id = v_source_root.id AND c.deleted_at IS NULL;

    SELECT COALESCE(jsonb_agg(c.id ORDER BY c.layer_index NULLS FIRST, c.created_at, c.id), '[]'::jsonb)
    INTO v_layer_ids
    FROM public.flashcards c
    WHERE c.parent_card_id = v_clone_group_id AND c.deleted_at IS NULL;
  END IF;

  IF v_entry.id IS NULL THEN
    INSERT INTO public.user_reinforcement_points(
      user_id, institution_id, source_card_id, source_group_uid, source_list_id,
      materialization_list_id, materialization_group_id, is_active, deactivated_at
    ) VALUES (
      v_uid, _institution_id, v_source.id, v_group_uid, v_source_list_id,
      v_area.list_id, v_clone_group_id, true, NULL
    ) RETURNING * INTO v_entry;
  ELSE
    UPDATE public.user_reinforcement_points
    SET source_card_id = v_source.id,
        source_group_uid = v_group_uid,
        source_list_id = v_source_list_id,
        materialization_list_id = v_area.list_id,
        materialization_group_id = v_clone_group_id,
        is_active = true,
        deactivated_at = NULL,
        updated_at = now()
    WHERE id = v_entry.id
    RETURNING * INTO v_entry;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'source_card_id', v_source.id,
    'source_group_uid', v_group_uid,
    'point_id', v_entry.id,
    'area_folder_id', v_area.folder_id,
    'area_list_id', v_area.list_id,
    'materialization_group_id', v_clone_group_id,
    'materialization_list_id', v_area.list_id,
    'materialization_layer_ids', v_layer_ids
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_reinforcement_points(
  _flashcard_ids uuid[],
  _enabled boolean,
  _institution_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_items jsonb := '[]'::jsonb;
BEGIN
  FOREACH v_id IN ARRAY COALESCE(_flashcard_ids, ARRAY[]::uuid[]) LOOP
    v_items := v_items || jsonb_build_array(
      public.set_user_reinforcement_point(v_id, _enabled, _institution_id)
    );
  END LOOP;
  RETURN jsonb_build_object('items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_reinforcement_point(uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_reinforcement_point(uuid, boolean, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.set_user_reinforcement_points(uuid[], boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_reinforcement_points(uuid[], boolean, uuid) TO authenticated;

COMMENT ON TABLE public.user_reinforcement_points IS
  'Canonical reversible reinforcement entries. The clone belongs only to this user and institution; source cards remain untouched.';

NOTIFY pgrst, 'reload schema';

COMMIT;
