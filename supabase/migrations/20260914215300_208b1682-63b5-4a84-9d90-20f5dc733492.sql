-- Study progress persistence delta v1.
-- Additive/idempotent: no row, table or user data is removed.
BEGIN;

-- 1. Missing session columns -------------------------------------------------
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS client_revision bigint NOT NULL DEFAULT 0;

-- 2. Widen the allowed study modes (superset of the legacy check) ------------
ALTER TABLE public.study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_mode_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_sessions_mode_check_v1') THEN
    ALTER TABLE public.study_sessions ADD CONSTRAINT study_sessions_mode_check_v1
      CHECK (mode IN ('flip', 'multiple-choice', 'write', 'mixed', 'mixed-adaptive', 'unscramble', 'pronunciation'));
  END IF;
END $$;

-- 3. One open session per logical scope --------------------------------------
-- Partial on purpose: legacy rows without a scope key are preserved untouched.
CREATE UNIQUE INDEX IF NOT EXISTS study_sessions_active_scope_unique_v1
  ON public.study_sessions(user_id, list_id, mode, session_scope_key)
  WHERE completed = false AND session_scope_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_study_sessions_active_scope_v1
  ON public.study_sessions(user_id, list_id, mode, session_scope_key, updated_at DESC)
  WHERE completed = false;

CREATE INDEX IF NOT EXISTS idx_study_sessions_open_updated_v1
  ON public.study_sessions(user_id, updated_at DESC)
  WHERE completed = false;

-- 4. Idempotency ledger for per-card attempts -------------------------------
CREATE TABLE IF NOT EXISTS public.study_progress_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_study_progress_events_user_created
  ON public.study_progress_events(user_id, created_at DESC);

GRANT SELECT ON public.study_progress_events TO authenticated;
GRANT ALL ON public.study_progress_events TO service_role;

ALTER TABLE public.study_progress_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'study_progress_events'
       AND policyname = 'study_progress_events_owner_select'
  ) THEN
    CREATE POLICY study_progress_events_owner_select
      ON public.study_progress_events FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. claim_study_session_v1 --------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_study_session_v1(
  p_list_id uuid,
  p_mode text,
  p_session_scope_key text,
  p_current_index integer,
  p_cards_order jsonb,
  p_settings_snapshot jsonb,
  p_session_snapshot jsonb,
  p_schema_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session public.study_sessions;
  v_created boolean := false;
  v_scope_key text := btrim(coalesce(p_session_scope_key, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_list_id IS NULL
     OR p_mode IS NULL
     OR p_current_index IS NULL
     OR p_current_index < 0
     OR p_cards_order IS NULL
     OR jsonb_typeof(p_cards_order) <> 'array'
     OR jsonb_array_length(p_cards_order) = 0
     OR v_scope_key = ''
     OR p_schema_version IS NULL
     OR p_schema_version <> 1 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  IF p_mode NOT IN (
    'flip', 'multiple-choice', 'write', 'mixed', 'mixed-adaptive',
    'unscramble', 'pronunciation'
  ) THEN
    RAISE EXCEPTION 'invalid_study_mode' USING ERRCODE = '22023';
  END IF;

  -- SECURITY DEFINER bypasses RLS: mirror the study read boundary.
  IF NOT EXISTS (
    SELECT 1
      FROM public.lists AS l
      LEFT JOIN public.folders AS f ON f.id = l.folder_id
     WHERE l.id = p_list_id
       AND l.deleted_at IS NULL
       AND (
         l.owner_id = v_user_id
         OR l.visibility = 'public'
         OR (
           l.visibility = 'class'
           AND l.class_id IS NOT NULL
           AND (
             public.is_turma_owner(l.class_id, v_user_id)
             OR public.is_turma_member(l.class_id, v_user_id)
           )
         )
         OR (f.visibility = 'public' AND f.deleted_at IS NULL)
         OR (
           f.visibility = 'class'
           AND f.class_id IS NOT NULL
           AND f.deleted_at IS NULL
           AND (
             public.is_turma_owner(f.class_id, v_user_id)
             OR public.is_turma_member(f.class_id, v_user_id)
           )
         )
       )
  ) THEN
    RAISE EXCEPTION 'study_access_denied' USING ERRCODE = '42501';
  END IF;

  -- Serialization key only; it cannot merge scopes or users.
  PERFORM pg_advisory_xact_lock(
    hashtext(concat_ws('|', v_user_id::text, p_list_id::text, p_mode, v_scope_key))::bigint
  );

  SELECT s.*
    INTO v_session
    FROM public.study_sessions AS s
   WHERE s.user_id = v_user_id
     AND s.list_id = p_list_id
     AND s.mode = p_mode
     AND s.session_scope_key = v_scope_key
     AND s.completed = false
   ORDER BY s.updated_at DESC, s.created_at DESC, s.id DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.study_sessions (
      user_id, list_id, mode, current_index, cards_order,
      session_scope_key, settings_snapshot, session_snapshot,
      schema_version, completed
    ) VALUES (
      v_user_id, p_list_id, p_mode, p_current_index, p_cards_order,
      v_scope_key, p_settings_snapshot, p_session_snapshot,
      p_schema_version, false
    )
    ON CONFLICT (user_id, list_id, mode, session_scope_key)
      WHERE completed = false AND session_scope_key IS NOT NULL
      DO NOTHING
    RETURNING * INTO v_session;

    IF v_session.id IS NULL THEN
      -- Another writer won the race: reuse its row instead of failing.
      SELECT s.* INTO v_session
        FROM public.study_sessions AS s
       WHERE s.user_id = v_user_id
         AND s.list_id = p_list_id
         AND s.mode = p_mode
         AND s.session_scope_key = v_scope_key
         AND s.completed = false
       ORDER BY s.updated_at DESC, s.created_at DESC, s.id DESC
       LIMIT 1;
      IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'study_session_claim_failed' USING ERRCODE = 'P0002';
      END IF;
    ELSE
      v_created := true;
    END IF;
  END IF;

  RETURN jsonb_build_object('created', v_created, 'session', to_jsonb(v_session));
END;
$$;

REVOKE ALL ON FUNCTION public.claim_study_session_v1(uuid, text, text, integer, jsonb, jsonb, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_study_session_v1(uuid, text, text, integer, jsonb, jsonb, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_study_session_v1(uuid, text, text, integer, jsonb, jsonb, jsonb, integer) TO service_role;

-- 6. persist_study_session_v1 (compare-and-set on client_revision) ----------
CREATE OR REPLACE FUNCTION public.persist_study_session_v1(
  p_session_id uuid,
  p_revision bigint,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_revision bigint;
  v_saved_revision bigint;
  v_accepted boolean := false;
  v_current_index integer;
  v_has_current_index boolean := false;
  v_has_completed boolean := false;
  v_completed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL
     OR p_revision IS NULL
     OR p_revision < 0
     OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'current_index' THEN
    IF jsonb_typeof(p_payload->'current_index') <> 'number'
       OR (p_payload->>'current_index')::integer < 0 THEN
      RAISE EXCEPTION 'invalid_current_index' USING ERRCODE = '22023';
    END IF;
    v_current_index := (p_payload->>'current_index')::integer;
    v_has_current_index := true;
  END IF;

  IF p_payload ? 'completed' THEN
    IF jsonb_typeof(p_payload->'completed') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_completed' USING ERRCODE = '22023';
    END IF;
    v_completed := (p_payload->>'completed')::boolean;
    v_has_completed := true;
  END IF;

  IF p_payload ? 'cards_order' THEN
    IF jsonb_typeof(p_payload->'cards_order') <> 'array'
       OR (NOT coalesce(v_completed, false) AND jsonb_array_length(p_payload->'cards_order') = 0) THEN
      RAISE EXCEPTION 'invalid_cards_order' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.study_sessions AS s
     SET current_index = CASE WHEN v_has_current_index THEN v_current_index ELSE s.current_index END,
         cards_order = CASE WHEN p_payload ? 'cards_order' THEN p_payload->'cards_order' ELSE s.cards_order END,
         session_scope_key = CASE
           WHEN jsonb_typeof(p_payload->'session_scope_key') = 'string'
           THEN p_payload->>'session_scope_key'
           ELSE s.session_scope_key
         END,
         settings_snapshot = CASE
           WHEN p_payload ? 'settings_snapshot' THEN p_payload->'settings_snapshot'
           ELSE s.settings_snapshot
         END,
         session_snapshot = CASE
           WHEN p_payload ? 'session_snapshot' THEN p_payload->'session_snapshot'
           ELSE s.session_snapshot
         END,
         completed = CASE WHEN v_has_completed THEN v_completed ELSE s.completed END,
         client_revision = p_revision,
         updated_at = now()
   WHERE s.id = p_session_id
     AND s.user_id = v_user_id
     AND p_revision > s.client_revision
   RETURNING s.client_revision INTO v_saved_revision;

  IF FOUND THEN
    v_accepted := true;
  ELSE
    SELECT s.client_revision
      INTO v_existing_revision
      FROM public.study_sessions AS s
     WHERE s.id = p_session_id
       AND s.user_id = v_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'study_session_not_found' USING ERRCODE = 'P0002';
    END IF;
    v_saved_revision := v_existing_revision;
  END IF;

  RETURN jsonb_build_object('accepted', v_accepted, 'revision', v_saved_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.persist_study_session_v1(uuid, bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_study_session_v1(uuid, bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.persist_study_session_v1(uuid, bigint, jsonb) TO service_role;

-- 7. record_flashcard_progress_v1 (idempotent, canonical card) --------------
CREATE OR REPLACE FUNCTION public.record_flashcard_progress_v1(
  p_flashcard_id uuid,
  p_list_id uuid,
  p_correct boolean,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
  v_progress public.flashcard_progress;
  v_canonical_list_id uuid;
  v_allowed boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_flashcard_id IS NULL OR p_list_id IS NULL OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  -- The canonical owner list of the card. Progress is always attached here, so
  -- a combined/embedded list never creates a second progress row.
  SELECT f.list_id INTO v_canonical_list_id
    FROM public.flashcards AS f
   WHERE f.id = p_flashcard_id
     AND f.deleted_at IS NULL;
  IF v_canonical_list_id IS NULL THEN
    RAISE EXCEPTION 'study_access_denied' USING ERRCODE = '42501';
  END IF;

  -- SECURITY DEFINER bypasses RLS: mirror the study read boundary.
  SELECT EXISTS (
    SELECT 1
      FROM public.flashcards AS f
      JOIN public.lists AS l ON l.id = f.list_id
      LEFT JOIN public.folders AS folder ON folder.id = l.folder_id
     WHERE f.id = p_flashcard_id
       AND f.list_id = p_list_id
       AND f.deleted_at IS NULL
       AND l.deleted_at IS NULL
       AND (
         f.user_id = v_user_id
         OR l.visibility = 'public'
         OR (
           l.visibility = 'class'
           AND l.class_id IS NOT NULL
           AND (
             public.is_turma_owner(l.class_id, v_user_id)
             OR public.is_turma_member(l.class_id, v_user_id)
           )
         )
         OR folder.visibility = 'public'
         OR (
           folder.visibility = 'class'
           AND folder.class_id IS NOT NULL
           AND (
             public.is_turma_owner(folder.class_id, v_user_id)
             OR public.is_turma_member(folder.class_id, v_user_id)
           )
         )
       )
  ) INTO v_allowed;

  -- Combined/embedded list: the deck is built from original cards, so the
  -- session list is not the card's own list. Accept it only when the caller
  -- owns the embedded list and the card is really a member of it.
  IF NOT v_allowed AND to_regclass('public.embedded_list_cards') IS NOT NULL THEN
    EXECUTE $q$
      SELECT EXISTS (
        SELECT 1
          FROM public.embedded_list_cards AS elc
          JOIN public.lists AS el ON el.id = elc.embedded_list_id
          JOIN public.flashcards AS f ON f.id = elc.flashcard_id
         WHERE elc.embedded_list_id = $1
           AND elc.flashcard_id = $2
           AND el.owner_id = $3
           AND el.deleted_at IS NULL
           AND f.deleted_at IS NULL
      )
    $q$
    INTO v_allowed
    USING p_list_id, p_flashcard_id, v_user_id;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'study_access_denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.study_progress_events
    (user_id, operation_id, flashcard_id, list_id, correct)
  VALUES
    (v_user_id, p_operation_id, p_flashcard_id, v_canonical_list_id, p_correct)
  ON CONFLICT (user_id, operation_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_progress
      FROM public.flashcard_progress
     WHERE user_id = v_user_id
       AND flashcard_id = p_flashcard_id;
    RETURN jsonb_build_object('applied', false, 'duplicate', true, 'progress_id', v_progress.id);
  END IF;

  INSERT INTO public.flashcard_progress
    (user_id, flashcard_id, list_id, correct_count, incorrect_count, last_reviewed)
  VALUES
    (v_user_id, p_flashcard_id, v_canonical_list_id,
     CASE WHEN p_correct THEN 1 ELSE 0 END,
     CASE WHEN p_correct THEN 0 ELSE 1 END,
     now())
  ON CONFLICT (user_id, flashcard_id) DO UPDATE
    SET correct_count = public.flashcard_progress.correct_count + EXCLUDED.correct_count,
        incorrect_count = public.flashcard_progress.incorrect_count + EXCLUDED.incorrect_count,
        list_id = EXCLUDED.list_id,
        last_reviewed = EXCLUDED.last_reviewed,
        updated_at = now()
  RETURNING * INTO v_progress;

  RETURN jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'progress_id', v_progress.id,
    'correct_count', v_progress.correct_count,
    'incorrect_count', v_progress.incorrect_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_flashcard_progress_v1(uuid, uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_flashcard_progress_v1(uuid, uuid, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_flashcard_progress_v1(uuid, uuid, boolean, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';