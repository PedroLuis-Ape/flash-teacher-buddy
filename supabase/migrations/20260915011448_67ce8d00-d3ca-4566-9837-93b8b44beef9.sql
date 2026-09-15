ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_card_id uuid,
  ADD COLUMN IF NOT EXISTS last_activity_index integer,
  ADD COLUMN IF NOT EXISTS last_activity_layer_index integer;

CREATE INDEX IF NOT EXISTS study_sessions_user_last_activity_idx
  ON public.study_sessions (user_id, last_activity_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.touch_study_session_activity_v1(
  p_session_id uuid,
  p_revision bigint,
  p_card_id uuid DEFAULT NULL,
  p_card_index integer DEFAULT NULL,
  p_layer_index integer DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF p_session_id IS NULL OR p_revision IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments';
  END IF;

  UPDATE public.study_sessions
     SET last_activity_at = now(),
         last_activity_revision = p_revision,
         last_activity_card_id = p_card_id,
         last_activity_index = p_card_index,
         last_activity_layer_index = p_layer_index
   WHERE id = p_session_id
     AND user_id = v_uid
     AND COALESCE(last_activity_revision, 0) < p_revision
  RETURNING last_activity_at INTO v_result;

  IF v_result IS NULL THEN
    SELECT last_activity_at INTO v_result
      FROM public.study_sessions
     WHERE id = p_session_id AND user_id = v_uid;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_study_session_activity_v1(uuid, bigint, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_study_session_activity_v1(uuid, bigint, uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.touch_study_session_activity_v1(uuid, bigint, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_study_session_activity_v1(uuid, bigint, uuid, integer, integer) TO service_role;