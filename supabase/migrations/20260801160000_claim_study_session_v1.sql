-- Atomic study-session claim for concurrent tabs.
-- Additive only: existing sessions are never deleted or rewritten. The RPC
-- returns the newest open session for the same user/list/mode/scope, or
-- creates one while holding a transaction-scoped advisory lock.
BEGIN;

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

  -- SECURITY DEFINER bypasses RLS. Keep the same read boundary as the study
  -- loaders before creating a row for a private, public, or class resource.
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
         OR (
           f.visibility = 'public'
           AND f.deleted_at IS NULL
         )
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

  -- The key is only a serialization key; it does not change row identity and
  -- therefore cannot merge sessions from different scopes or users.
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
      user_id,
      list_id,
      mode,
      current_index,
      cards_order,
      session_scope_key,
      settings_snapshot,
      session_snapshot,
      schema_version,
      completed
    ) VALUES (
      v_user_id,
      p_list_id,
      p_mode,
      p_current_index,
      p_cards_order,
      v_scope_key,
      p_settings_snapshot,
      p_session_snapshot,
      p_schema_version,
      false
    )
    RETURNING * INTO v_session;
    v_created := true;
  END IF;

  RETURN jsonb_build_object(
    'created', v_created,
    'session', to_jsonb(v_session)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_study_session_v1(uuid, text, text, integer, jsonb, jsonb, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_study_session_v1(uuid, text, text, integer, jsonb, jsonb, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_study_session_v1(uuid, text, text, integer, jsonb, jsonb, jsonb, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
