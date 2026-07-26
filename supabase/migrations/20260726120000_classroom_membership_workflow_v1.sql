-- Classroom membership workflow v1.
--
-- This migration is additive and keeps `turma_membros.ativo` as a compatibility
-- projection for existing readers. The canonical membership state is `status`.
-- All state transitions go through SECURITY DEFINER RPCs that derive the actor
-- from auth.uid(); clients do not receive direct write access to memberships.
-- No existing classroom, content, or account rows are deleted or rewritten.

BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

ALTER TABLE public.turma_membros
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS initiated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.turma_membros
SET status = CASE WHEN ativo THEN 'active' ELSE 'removed' END,
    updated_at = COALESCE(updated_at, now())
WHERE status IS NULL
   OR status NOT IN (
  'invited', 'requested', 'active', 'rejected', 'cancelled',
  'removed', 'left', 'expired'
  )
   OR (status = 'active' AND ativo = false);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.turma_membros'::regclass
      AND conname = 'turma_membros_status_check'
  ) THEN
    ALTER TABLE public.turma_membros
      ADD CONSTRAINT turma_membros_status_check
      CHECK (status IN (
        'invited', 'requested', 'active', 'rejected', 'cancelled',
        'removed', 'left', 'expired'
      ));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_turma_membros_status
  ON public.turma_membros (turma_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.turma_membership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.turma_membros(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT turma_membership_events_status_check CHECK (to_status IN (
    'invited', 'requested', 'active', 'rejected', 'cancelled',
    'removed', 'left', 'expired'
  ))
);

CREATE INDEX IF NOT EXISTS idx_turma_membership_events_turma_created
  ON public.turma_membership_events (turma_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_turma_membership_events_user_created
  ON public.turma_membership_events (user_id, created_at DESC);

ALTER TABLE public.turma_membership_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sync_turma_membership_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    NEW.status := CASE WHEN NEW.ativo THEN 'active' ELSE 'removed' END;
  END IF;

  IF NEW.status IS NULL THEN
    NEW.status := CASE WHEN COALESCE(NEW.ativo, true) THEN 'active' ELSE 'removed' END;
  END IF;

  NEW.ativo := NEW.status = 'active';
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_turma_membership_projection_trigger
  ON public.turma_membros;
CREATE TRIGGER sync_turma_membership_projection_trigger
BEFORE INSERT OR UPDATE ON public.turma_membros
FOR EACH ROW
EXECUTE FUNCTION public.sync_turma_membership_projection();

-- Replace the old broad owner write policy with read-only access. Mutations
-- below are atomic and authorization-checked in the RPCs.
DROP POLICY IF EXISTS "Turma owners can manage members" ON public.turma_membros;
DROP POLICY IF EXISTS "Turma owners can view members" ON public.turma_membros;
CREATE POLICY "Turma owners can view members"
ON public.turma_membros FOR SELECT
TO authenticated
USING (public.is_turma_owner(turma_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view their own membership" ON public.turma_membros;
CREATE POLICY "Members can view their own membership"
ON public.turma_membros FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Membership events are visible to participants" ON public.turma_membership_events;
CREATE POLICY "Membership events are visible to participants"
ON public.turma_membership_events FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_turma_owner(turma_id, auth.uid())
);

REVOKE INSERT, UPDATE, DELETE ON public.turma_membros FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.turma_membership_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.transition_turma_membership_v1(
  p_turma_id uuid,
  p_action text,
  p_target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_target_id uuid := p_target_user_id;
  v_turma public.turmas%ROWTYPE;
  v_member public.turma_membros%ROWTYPE;
  v_actor_is_teacher boolean;
  v_target_is_student boolean;
  v_from_status text;
  v_to_status text;
  v_action text := lower(btrim(COALESCE(p_action, '')));
  v_now timestamptz := now();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_turma_id IS NULL THEN
    RAISE EXCEPTION 'Classroom is required' USING ERRCODE = '22023';
  END IF;

  IF v_action NOT IN (
    'request_join', 'invite', 'approve_request', 'reject_request',
    'cancel_request', 'accept_invite', 'reject_invite', 'cancel_invite',
    'add_direct', 'remove_member', 'leave'
  ) THEN
    RAISE EXCEPTION 'Unsupported membership action' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_turma
  FROM public.turmas
  WHERE id = p_turma_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_turma.ativo THEN
    RAISE EXCEPTION 'Classroom not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(p.is_teacher, false)
  INTO v_actor_is_teacher
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  IF v_action IN (
    'invite', 'approve_request', 'reject_request', 'cancel_invite',
    'add_direct', 'remove_member'
  ) THEN
    IF v_turma.owner_teacher_id <> v_actor_id OR NOT COALESCE(v_actor_is_teacher, false) THEN
      RAISE EXCEPTION 'Only the classroom teacher can perform this action' USING ERRCODE = '42501';
    END IF;
    IF v_target_id IS NULL OR v_target_id = v_actor_id THEN
      RAISE EXCEPTION 'A different student is required' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_target_id := v_actor_id;
  END IF;

  SELECT NOT COALESCE(p.is_teacher, false)
  INTO v_target_is_student
  FROM public.profiles p
  WHERE p.id = v_target_id;

  IF NOT COALESCE(v_target_is_student, false) THEN
    RAISE EXCEPTION 'Only student profiles can participate as students' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member
  FROM public.turma_membros
  WHERE turma_id = p_turma_id
    AND user_id = v_target_id
  FOR UPDATE;

  v_from_status := CASE
    WHEN FOUND THEN COALESCE(v_member.status, CASE WHEN v_member.ativo THEN 'active' ELSE 'removed' END)
    ELSE NULL
  END;

  IF v_action = 'request_join' THEN
    IF v_turma.owner_teacher_id = v_actor_id THEN
      RAISE EXCEPTION 'The classroom owner cannot request their own classroom' USING ERRCODE = '42501';
    END IF;
    IF v_from_status = 'active' OR v_from_status = 'requested' OR v_from_status = 'invited' THEN
      RETURN jsonb_build_object('success', true, 'status', v_from_status, 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    v_to_status := 'requested';
  ELSIF v_action = 'invite' THEN
    IF v_from_status = 'active' OR v_from_status = 'invited' THEN
      RETURN jsonb_build_object('success', true, 'status', v_from_status, 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    v_to_status := CASE WHEN v_from_status = 'requested' THEN 'active' ELSE 'invited' END;
  ELSIF v_action = 'approve_request' THEN
    IF v_from_status = 'active' THEN
      RETURN jsonb_build_object('success', true, 'status', 'active', 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    IF v_from_status <> 'requested' THEN
      RAISE EXCEPTION 'Only a pending request can be approved' USING ERRCODE = 'P0001';
    END IF;
    v_to_status := 'active';
  ELSIF v_action = 'reject_request' THEN
    IF v_from_status IN ('rejected', 'cancelled') THEN
      RETURN jsonb_build_object('success', true, 'status', v_from_status, 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    IF v_from_status <> 'requested' THEN
      RAISE EXCEPTION 'Only a pending request can be rejected' USING ERRCODE = 'P0001';
    END IF;
    v_to_status := 'rejected';
  ELSIF v_action = 'cancel_request' THEN
    IF v_from_status = 'cancelled' THEN
      RETURN jsonb_build_object('success', true, 'status', 'cancelled', 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    IF v_from_status <> 'requested' THEN
      RAISE EXCEPTION 'Only a pending request can be cancelled' USING ERRCODE = 'P0001';
    END IF;
    v_to_status := 'cancelled';
  ELSIF v_action = 'accept_invite' THEN
    IF v_from_status = 'active' THEN
      RETURN jsonb_build_object('success', true, 'status', 'active', 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    IF v_from_status <> 'invited' THEN
      RAISE EXCEPTION 'Only a pending invitation can be accepted' USING ERRCODE = 'P0001';
    END IF;
    v_to_status := 'active';
  ELSIF v_action = 'reject_invite' THEN
    IF v_from_status = 'rejected' THEN
      RETURN jsonb_build_object('success', true, 'status', 'rejected', 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    IF v_from_status <> 'invited' THEN
      RAISE EXCEPTION 'Only a pending invitation can be rejected' USING ERRCODE = 'P0001';
    END IF;
    v_to_status := 'rejected';
  ELSIF v_action = 'cancel_invite' THEN
    IF v_from_status = 'cancelled' THEN
      RETURN jsonb_build_object('success', true, 'status', 'cancelled', 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    IF v_from_status <> 'invited' THEN
      RAISE EXCEPTION 'Only a pending invitation can be cancelled' USING ERRCODE = 'P0001';
    END IF;
    v_to_status := 'cancelled';
  ELSIF v_action = 'add_direct' THEN
    IF v_from_status = 'active' THEN
      RETURN jsonb_build_object('success', true, 'status', 'active', 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    v_to_status := 'active';
  ELSIF v_action = 'remove_member' THEN
    IF v_from_status = 'removed' THEN
      RETURN jsonb_build_object('success', true, 'status', 'removed', 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    IF v_from_status <> 'active' THEN
      RAISE EXCEPTION 'Only an active member can be removed' USING ERRCODE = 'P0001';
    END IF;
    v_to_status := 'removed';
  ELSIF v_action = 'leave' THEN
    IF v_from_status = 'left' THEN
      RETURN jsonb_build_object('success', true, 'status', 'left', 'idempotent', true, 'turma_id', p_turma_id);
    END IF;
    IF v_from_status <> 'active' THEN
      RAISE EXCEPTION 'Only an active member can leave' USING ERRCODE = 'P0001';
    END IF;
    v_to_status := 'left';
  END IF;

  IF v_member.id IS NULL THEN
    INSERT INTO public.turma_membros (
      turma_id, user_id, role, ativo, status, initiated_by,
      requested_at, invited_at, resolved_at, resolved_by
    ) VALUES (
      p_turma_id, v_target_id, 'aluno'::public.turma_role, v_to_status = 'active',
      v_to_status, v_actor_id,
      CASE WHEN v_to_status = 'requested' THEN v_now END,
      CASE WHEN v_to_status = 'invited' THEN v_now END,
      CASE WHEN v_to_status NOT IN ('requested', 'invited') THEN v_now END,
      CASE WHEN v_to_status NOT IN ('requested', 'invited') THEN v_actor_id END
    )
    RETURNING * INTO v_member;
  ELSE
    UPDATE public.turma_membros
    SET status = v_to_status,
        ativo = v_to_status = 'active',
        initiated_by = v_actor_id,
        requested_at = CASE WHEN v_to_status = 'requested' THEN v_now ELSE requested_at END,
        invited_at = CASE WHEN v_to_status = 'invited' THEN v_now ELSE invited_at END,
        resolved_at = CASE WHEN v_to_status NOT IN ('requested', 'invited') THEN v_now ELSE NULL END,
        resolved_by = CASE WHEN v_to_status NOT IN ('requested', 'invited') THEN v_actor_id ELSE NULL END
    WHERE id = v_member.id
    RETURNING * INTO v_member;
  END IF;

  INSERT INTO public.turma_membership_events (
    turma_id, membership_id, user_id, actor_id, action, from_status, to_status
  ) VALUES (
    p_turma_id, v_member.id, v_target_id, v_actor_id, v_action, v_from_status, v_to_status
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_to_status,
    'idempotent', false,
    'turma_id', p_turma_id,
    'user_id', v_target_id,
    'membership_id', v_member.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_students_to_turma_v1(
  p_turma_id uuid,
  p_student_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_owner_id uuid;
  v_count integer;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_student_ids IS NULL OR cardinality(p_student_ids) < 1 OR cardinality(p_student_ids) > 100 THEN
    RAISE EXCEPTION 'Between one and one hundred students are required' USING ERRCODE = '22023';
  END IF;

  SELECT owner_teacher_id INTO v_owner_id
  FROM public.turmas
  WHERE id = p_turma_id AND ativo = true
  FOR UPDATE;

  IF v_owner_id IS NULL OR v_owner_id <> v_actor_id THEN
    RAISE EXCEPTION 'Only the active classroom owner can add students' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_actor_id AND COALESCE(p.is_teacher, false) = true
  ) THEN
    RAISE EXCEPTION 'Only teachers can add students' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_student_ids) AS ids(id)
    LEFT JOIN public.profiles p ON p.id = ids.id
    WHERE p.id IS NULL OR COALESCE(p.is_teacher, false) = true OR p.id = v_actor_id
  ) THEN
    RAISE EXCEPTION 'Every target must be an existing student profile' USING ERRCODE = '42501';
  END IF;

  WITH target AS (
    SELECT DISTINCT id AS user_id FROM unnest(p_student_ids) AS ids(id)
  ), upserted AS (
    INSERT INTO public.turma_membros (
      turma_id, user_id, role, ativo, status, initiated_by, resolved_at, resolved_by
    )
    SELECT p_turma_id, target.user_id, 'aluno'::public.turma_role, true, 'active', v_actor_id, now(), v_actor_id
    FROM target
    ON CONFLICT (turma_id, user_id) DO UPDATE
      SET role = 'aluno'::public.turma_role,
          ativo = true,
          status = 'active',
          initiated_by = v_actor_id,
          resolved_at = now(),
          resolved_by = v_actor_id
    RETURNING id, turma_id, user_id
  )
  INSERT INTO public.turma_membership_events (
    turma_id, membership_id, user_id, actor_id, action, from_status, to_status
  )
  SELECT turma_id, id, user_id, v_actor_id, 'add_direct', NULL, 'active'
  FROM upserted;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'added_count', v_count, 'turma_id', p_turma_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.search_turma_people_v1(
  p_kind text,
  p_turma_id uuid DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  public_id text,
  display_name text,
  username text,
  avatar_url text,
  is_teacher boolean,
  membership_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_query text := NULLIF(BTRIM(COALESCE(p_query, '')), '');
  v_kind text := lower(BTRIM(COALESCE(p_kind, '')));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF v_kind NOT IN ('teacher', 'student') THEN
    RAISE EXCEPTION 'Search kind is invalid' USING ERRCODE = '22023';
  END IF;
  IF v_query IS NULL OR char_length(v_query) < 2 THEN
    RETURN;
  END IF;

  IF v_kind = 'student' THEN
    IF p_turma_id IS NULL OR NOT public.is_turma_owner(p_turma_id, v_actor_id) THEN
      RAISE EXCEPTION 'Only the classroom owner can search its students' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
      COALESCE(NULLIF(BTRIM(p.ape_id), ''), NULLIF(BTRIM(p.user_tag), '')) AS public_id,
      COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Aluno') AS display_name,
      NULLIF(BTRIM(p.user_tag), '') AS username,
      p.avatar_url,
      COALESCE(p.is_teacher, false),
      tm.status
    FROM public.profiles p
    LEFT JOIN public.turma_membros tm
      ON tm.turma_id = p_turma_id AND tm.user_id = p.id
    WHERE COALESCE(p.is_teacher, false) = false
      AND p.user_type::text = 'aluno'
      AND COALESCE(NULLIF(BTRIM(p.ape_id), ''), NULLIF(BTRIM(p.user_tag), '')) IS NOT NULL
      AND (
        extensions.unaccent(lower(COALESCE(p.first_name, ''))) LIKE '%' || extensions.unaccent(lower(v_query)) || '%'
        OR lower(COALESCE(p.ape_id, '')) LIKE '%' || lower(v_query) || '%'
        OR lower(COALESCE(p.user_tag, '')) LIKE '%' || lower(v_query) || '%'
      )
    ORDER BY extensions.unaccent(lower(COALESCE(p.first_name, ''))), public_id
    LIMIT v_limit OFFSET v_offset;
  ELSE
    RETURN QUERY
    SELECT
      COALESCE(NULLIF(BTRIM(p.public_slug), ''), NULLIF(BTRIM(p.user_tag), ''), NULLIF(BTRIM(p.ape_id), '')) AS public_id,
      COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor') AS display_name,
      COALESCE(NULLIF(BTRIM(p.public_slug), ''), NULLIF(BTRIM(p.user_tag), '')) AS username,
      p.avatar_url,
      true,
      NULL::text
    FROM public.profiles p
    WHERE COALESCE(p.is_teacher, false) = true
      AND p.user_type::text = 'professor'
      AND COALESCE(p.public_profile_searchable, false) = true
      AND COALESCE(p.public_access_enabled, false) = true
      AND NULLIF(BTRIM(p.public_slug), '') IS NOT NULL
      AND (
        extensions.unaccent(lower(COALESCE(p.first_name, ''))) LIKE '%' || extensions.unaccent(lower(v_query)) || '%'
        OR lower(COALESCE(p.public_slug, '')) LIKE '%' || lower(v_query) || '%'
        OR lower(COALESCE(p.user_tag, '')) LIKE '%' || lower(v_query) || '%'
        OR lower(COALESCE(p.ape_id, '')) LIKE '%' || lower(v_query) || '%'
      )
    ORDER BY extensions.unaccent(lower(COALESCE(p.first_name, ''))), public_id
    LIMIT v_limit OFFSET v_offset;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_turma_access_v1(p_turma_id uuid)
RETURNS TABLE (
  turma_id uuid,
  nome text,
  owner_teacher_id uuid,
  is_public boolean,
  membership_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    t.id,
    t.nome,
    t.owner_teacher_id,
    t.public,
    CASE
      WHEN t.owner_teacher_id = auth.uid() THEN 'active'::text
      ELSE tm.status
    END
  FROM public.turmas t
  LEFT JOIN public.turma_membros tm
    ON tm.turma_id = t.id
   AND tm.user_id = auth.uid()
  WHERE t.id = p_turma_id
    AND (t.owner_teacher_id = auth.uid() OR tm.user_id IS NOT NULL)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.list_my_turma_memberships_v1()
RETURNS TABLE (
  membership_id uuid,
  turma_id uuid,
  nome text,
  descricao text,
  is_public boolean,
  status text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    tm.id,
    tm.turma_id,
    t.nome,
    t.descricao,
    t.public,
    tm.status,
    tm.updated_at
  FROM public.turma_membros tm
  JOIN public.turmas t ON t.id = tm.turma_id
  WHERE tm.user_id = auth.uid()
    AND tm.status IN ('requested', 'invited')
  ORDER BY tm.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.transition_turma_membership_public_v1(
  p_turma_id uuid,
  p_action text,
  p_target_public_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target_id uuid;
BEGIN
  SELECT p.id
  INTO v_target_id
  FROM public.profiles p
  WHERE p.id::text = BTRIM(p_target_public_id)
     OR UPPER(BTRIM(p.ape_id)) = UPPER(BTRIM(p_target_public_id))
     OR UPPER(BTRIM(p.user_tag)) = UPPER(BTRIM(p_target_public_id))
  ORDER BY (p.id::text = BTRIM(p_target_public_id)) DESC
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN public.transition_turma_membership_v1(p_turma_id, p_action, v_target_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_students_to_turma_by_public_id_v1(
  p_turma_id uuid,
  p_public_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ids uuid[];
  v_requested integer;
  v_resolved integer;
BEGIN
  IF p_public_ids IS NULL OR cardinality(p_public_ids) < 1 OR cardinality(p_public_ids) > 100 THEN
    RAISE EXCEPTION 'Between one and one hundred students are required' USING ERRCODE = '22023';
  END IF;

  WITH requested AS (
    SELECT DISTINCT BTRIM(value) AS value
    FROM unnest(p_public_ids) AS values(value)
    WHERE BTRIM(value) <> ''
  ), resolved AS (
    SELECT
      requested.value,
      (
        SELECT p.id
        FROM public.profiles p
        WHERE lower(p.id::text) = lower(requested.value)
           OR UPPER(BTRIM(p.ape_id)) = UPPER(requested.value)
           OR UPPER(BTRIM(p.user_tag)) = UPPER(requested.value)
        ORDER BY (lower(p.id::text) = lower(requested.value)) DESC, p.id
        LIMIT 1
      ) AS user_id
    FROM requested
  )
  SELECT array_agg(user_id ORDER BY user_id) FILTER (WHERE user_id IS NOT NULL),
         COUNT(user_id)::integer
  INTO v_ids, v_resolved
  FROM resolved;

  SELECT COUNT(DISTINCT BTRIM(value))::integer
  INTO v_requested
  FROM unnest(p_public_ids) AS values(value)
  WHERE BTRIM(value) <> '';

  IF COALESCE(v_resolved, 0) <> v_requested THEN
    RAISE EXCEPTION 'One or more students could not be found' USING ERRCODE = 'P0002';
  END IF;

  RETURN public.add_students_to_turma_v1(p_turma_id, v_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_turma_membership_v1(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_turma_membership_v1(uuid, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.add_students_to_turma_v1(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_students_to_turma_v1(uuid, uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.search_turma_people_v1(text, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_turma_people_v1(text, uuid, text, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.get_turma_access_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_turma_access_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.list_my_turma_memberships_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_turma_memberships_v1() TO authenticated;
REVOKE ALL ON FUNCTION public.transition_turma_membership_public_v1(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_turma_membership_public_v1(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.add_students_to_turma_by_public_id_v1(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_students_to_turma_by_public_id_v1(uuid, text[]) TO authenticated;

COMMENT ON COLUMN public.turma_membros.status IS
  'Canonical membership workflow state; ativo is maintained as a compatibility projection.';
COMMENT ON FUNCTION public.transition_turma_membership_v1(uuid, text, uuid) IS
  'Atomic, idempotent classroom membership transition for requests, invites, approval, removal and exit.';
COMMENT ON FUNCTION public.search_turma_people_v1(text, uuid, text, integer, integer) IS
  'Bounded, role-aware classroom search returning public profile fields only.';
COMMENT ON FUNCTION public.get_turma_access_v1(uuid) IS
  'Returns the minimum classroom access projection for the authenticated owner or membership subject, including pending workflow states.';
COMMENT ON FUNCTION public.list_my_turma_memberships_v1() IS
  'Lists only the authenticated student pending classroom memberships and minimum class metadata.';
COMMENT ON FUNCTION public.transition_turma_membership_public_v1(uuid, text, text) IS
  'Resolves a public student identifier inside the server boundary before applying a membership transition.';
COMMENT ON FUNCTION public.add_students_to_turma_by_public_id_v1(uuid, text[]) IS
  'Resolves bounded public student identifiers inside the server boundary before a transactional bulk add.';

COMMIT;
