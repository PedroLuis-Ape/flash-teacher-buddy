-- Autonomous study persistence v1.
-- Additive only: no session, card, progress, or preference row is removed.
-- The RPC is the server-side fence that makes the existing latest-write queue
-- safe across tabs and devices.
BEGIN;

ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS client_revision bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_study_sessions_client_revision_v1
  ON public.study_sessions(user_id, list_id, mode, session_scope_key, client_revision DESC)
  WHERE completed = false;

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

  RETURN jsonb_build_object(
    'accepted', v_accepted,
    'revision', v_saved_revision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.persist_study_session_v1(uuid, bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_study_session_v1(uuid, bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.persist_study_session_v1(uuid, bigint, jsonb) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
