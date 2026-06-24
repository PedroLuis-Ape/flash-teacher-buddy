-- Lightweight classroom engagement analytics.
-- Registered students remain identifiable to the classroom owner.
-- Guests are counted through a random browser token that is hashed before storage;
-- no IP address, fingerprint, email or raw guest token is stored.

CREATE TABLE IF NOT EXISTS public.turma_engagement_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  atribuicao_id uuid REFERENCES public.atribuicoes(id) ON DELETE SET NULL,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_hash text NOT NULL,
  session_token uuid NOT NULL,
  mode text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT turma_engagement_sessions_unique_token UNIQUE (turma_id, session_token)
);

CREATE TABLE IF NOT EXISTS public.turma_engagement_cards (
  session_id uuid NOT NULL REFERENCES public.turma_engagement_sessions(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  answer_count integer NOT NULL DEFAULT 0 CHECK (answer_count >= 0),
  correct_count integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  incorrect_count integer NOT NULL DEFAULT 0 CHECK (incorrect_count >= 0),
  last_practiced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, card_id)
);

ALTER TABLE public.turma_engagement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turma_engagement_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can read turma engagement sessions" ON public.turma_engagement_sessions;
CREATE POLICY "Teachers can read turma engagement sessions"
ON public.turma_engagement_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.id = turma_engagement_sessions.turma_id
      AND t.owner_teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can read turma engagement cards" ON public.turma_engagement_cards;
CREATE POLICY "Teachers can read turma engagement cards"
ON public.turma_engagement_cards
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.id = turma_engagement_cards.turma_id
      AND t.owner_teacher_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_turma_engagement_sessions_turma_time
  ON public.turma_engagement_sessions (turma_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_turma_engagement_sessions_user
  ON public.turma_engagement_sessions (turma_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_turma_engagement_sessions_guest
  ON public.turma_engagement_sessions (turma_id, visitor_hash)
  WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_turma_engagement_cards_turma_card
  ON public.turma_engagement_cards (turma_id, card_id, last_practiced_at DESC);
CREATE INDEX IF NOT EXISTS idx_turma_engagement_cards_list
  ON public.turma_engagement_cards (turma_id, list_id, last_practiced_at DESC);

CREATE OR REPLACE FUNCTION public.record_turma_engagement_v1(
  _turma_id uuid,
  _list_id uuid,
  _session_token uuid,
  _visitor_token text,
  _event_type text,
  _mode text DEFAULT NULL,
  _card_id uuid DEFAULT NULL,
  _correct boolean DEFAULT NULL,
  _atribuicao_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_public boolean;
  v_active boolean;
  v_assignment_id uuid;
  v_visitor_hash text;
  v_session_id uuid;
BEGIN
  IF _event_type NOT IN ('open', 'card_view', 'answer', 'complete') THEN
    RAISE EXCEPTION 'Unsupported engagement event.' USING ERRCODE = '22023';
  END IF;

  IF _session_token IS NULL THEN
    RAISE EXCEPTION 'Session token is required.' USING ERRCODE = '22023';
  END IF;

  SELECT t.owner_teacher_id, COALESCE(t.public, false), COALESCE(t.ativo, true)
  INTO v_owner_id, v_public, v_active
  FROM public.turmas t
  WHERE t.id = _turma_id;

  IF v_owner_id IS NULL OR NOT v_active THEN
    RAISE EXCEPTION 'Classroom is unavailable.' USING ERRCODE = 'P0002';
  END IF;

  IF v_user_id IS NULL THEN
    IF NOT v_public THEN
      RAISE EXCEPTION 'Anonymous analytics are available only for public classrooms.' USING ERRCODE = '42501';
    END IF;
    IF _visitor_token IS NULL OR length(_visitor_token) < 16 OR length(_visitor_token) > 200 THEN
      RAISE EXCEPTION 'A valid anonymous visitor token is required.' USING ERRCODE = '22023';
    END IF;
  ELSIF NOT v_public
    AND v_user_id <> v_owner_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.turma_membros tm
      WHERE tm.turma_id = _turma_id
        AND tm.user_id = v_user_id
        AND tm.ativo = true
    ) THEN
    RAISE EXCEPTION 'You cannot record activity for this classroom.' USING ERRCODE = '42501';
  END IF;

  SELECT a.id
  INTO v_assignment_id
  FROM public.atribuicoes a
  JOIN public.lists l
    ON l.id = _list_id
   AND l.deleted_at IS NULL
   AND l.owner_id = v_owner_id
  LEFT JOIN public.folders f
    ON f.id = l.folder_id
   AND f.deleted_at IS NULL
   AND f.owner_id = v_owner_id
  WHERE a.turma_id = _turma_id
    AND (_atribuicao_id IS NULL OR a.id = _atribuicao_id)
    AND (
      (a.fonte_tipo::text = 'lista' AND a.fonte_id = l.id)
      OR
      (a.fonte_tipo::text = 'pasta' AND a.fonte_id = f.id)
    )
  ORDER BY CASE WHEN a.id = _atribuicao_id THEN 0 ELSE 1 END, a.created_at
  LIMIT 1;

  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'The list is not assigned to this classroom.' USING ERRCODE = '42501';
  END IF;

  IF _event_type IN ('card_view', 'answer') THEN
    IF _card_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.flashcards fc
      WHERE fc.id = _card_id
        AND fc.list_id = _list_id
        AND fc.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'The card does not belong to the selected list.' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_visitor_hash := CASE
    WHEN v_user_id IS NOT NULL THEN 'account:' || v_user_id::text
    ELSE 'guest:' || encode(digest(_visitor_token, 'sha256'), 'hex')
  END;

  INSERT INTO public.turma_engagement_sessions (
    turma_id,
    atribuicao_id,
    list_id,
    user_id,
    visitor_hash,
    session_token,
    mode,
    last_activity_at
  ) VALUES (
    _turma_id,
    v_assignment_id,
    _list_id,
    v_user_id,
    v_visitor_hash,
    _session_token,
    NULLIF(BTRIM(_mode), ''),
    now()
  )
  ON CONFLICT (turma_id, session_token) DO UPDATE
  SET last_activity_at = now(),
      atribuicao_id = COALESCE(EXCLUDED.atribuicao_id, turma_engagement_sessions.atribuicao_id),
      mode = COALESCE(EXCLUDED.mode, turma_engagement_sessions.mode)
  WHERE turma_engagement_sessions.visitor_hash = EXCLUDED.visitor_hash
    AND turma_engagement_sessions.user_id IS NOT DISTINCT FROM EXCLUDED.user_id
    AND turma_engagement_sessions.list_id = EXCLUDED.list_id
  RETURNING id INTO v_session_id;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'The engagement session token is already in use.' USING ERRCODE = '23505';
  END IF;

  IF _event_type = 'card_view' THEN
    INSERT INTO public.turma_engagement_cards (
      session_id, turma_id, list_id, card_id, view_count, last_practiced_at
    ) VALUES (
      v_session_id, _turma_id, _list_id, _card_id, 1, now()
    )
    ON CONFLICT (session_id, card_id) DO UPDATE
    SET view_count = public.turma_engagement_cards.view_count + 1,
        last_practiced_at = now();
  ELSIF _event_type = 'answer' THEN
    INSERT INTO public.turma_engagement_cards (
      session_id,
      turma_id,
      list_id,
      card_id,
      answer_count,
      correct_count,
      incorrect_count,
      last_practiced_at
    ) VALUES (
      v_session_id,
      _turma_id,
      _list_id,
      _card_id,
      1,
      CASE WHEN _correct IS TRUE THEN 1 ELSE 0 END,
      CASE WHEN _correct IS FALSE THEN 1 ELSE 0 END,
      now()
    )
    ON CONFLICT (session_id, card_id) DO UPDATE
    SET answer_count = public.turma_engagement_cards.answer_count + 1,
        correct_count = public.turma_engagement_cards.correct_count + CASE WHEN _correct IS TRUE THEN 1 ELSE 0 END,
        incorrect_count = public.turma_engagement_cards.incorrect_count + CASE WHEN _correct IS FALSE THEN 1 ELSE 0 END,
        last_practiced_at = now();
  ELSIF _event_type = 'complete' THEN
    UPDATE public.turma_engagement_sessions
    SET completed_at = COALESCE(completed_at, now()),
        last_activity_at = now()
    WHERE id = v_session_id;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'actor_type', CASE WHEN v_user_id IS NULL THEN 'guest' ELSE 'account' END,
    'recorded', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_turma_engagement_report_v1(
  _turma_id uuid,
  _days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(_days, 30), 1), 365);
  v_since timestamptz := now() - make_interval(days => LEAST(GREATEST(COALESCE(_days, 30), 1), 365));
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.id = _turma_id
      AND t.owner_teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the classroom owner can view engagement analytics.' USING ERRCODE = '42501';
  END IF;

  WITH filtered_sessions AS (
    SELECT s.*
    FROM public.turma_engagement_sessions s
    WHERE s.turma_id = _turma_id
      AND s.last_activity_at >= v_since
  ),
  card_totals AS (
    SELECT
      c.session_id,
      SUM(c.view_count)::integer AS card_views,
      SUM(c.answer_count)::integer AS answers,
      SUM(c.correct_count)::integer AS correct,
      SUM(c.incorrect_count)::integer AS incorrect
    FROM public.turma_engagement_cards c
    JOIN filtered_sessions s ON s.id = c.session_id
    GROUP BY c.session_id
  ),
  summary_row AS (
    SELECT
      COUNT(DISTINCT s.user_id) FILTER (WHERE s.user_id IS NOT NULL)::integer AS registered_visitors,
      COUNT(DISTINCT s.visitor_hash) FILTER (WHERE s.user_id IS NULL)::integer AS guest_visitors,
      COUNT(DISTINCT s.id)::integer AS sessions,
      COUNT(DISTINCT s.id) FILTER (WHERE s.completed_at IS NOT NULL)::integer AS completed_sessions,
      COALESCE(SUM(ct.card_views), 0)::integer AS card_views,
      COALESCE(SUM(ct.answers), 0)::integer AS answers,
      COALESCE(SUM(ct.correct), 0)::integer AS correct,
      MAX(s.last_activity_at) AS last_activity_at
    FROM filtered_sessions s
    LEFT JOIN card_totals ct ON ct.session_id = s.id
  ),
  student_rows AS (
    SELECT
      s.user_id,
      COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Aluno') AS first_name,
      p.ape_id,
      COUNT(DISTINCT s.id)::integer AS sessions,
      COALESCE(SUM(ct.card_views), 0)::integer AS card_views,
      COALESCE(SUM(ct.answers), 0)::integer AS answers,
      MAX(s.last_activity_at) AS last_activity_at
    FROM filtered_sessions s
    LEFT JOIN card_totals ct ON ct.session_id = s.id
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE s.user_id IS NOT NULL
    GROUP BY s.user_id, p.first_name, p.ape_id
    ORDER BY MAX(s.last_activity_at) DESC
  ),
  list_rows AS (
    SELECT
      s.list_id,
      COALESCE(l.title, 'Lista') AS title,
      COUNT(DISTINCT s.id)::integer AS sessions,
      COUNT(DISTINCT COALESCE(s.user_id::text, s.visitor_hash))::integer AS unique_visitors,
      COALESCE(SUM(ct.card_views), 0)::integer AS card_views,
      MAX(s.last_activity_at) AS last_activity_at
    FROM filtered_sessions s
    LEFT JOIN card_totals ct ON ct.session_id = s.id
    LEFT JOIN public.lists l ON l.id = s.list_id
    GROUP BY s.list_id, l.title
    ORDER BY COALESCE(SUM(ct.card_views), 0) DESC, COUNT(DISTINCT s.id) DESC
    LIMIT 10
  ),
  card_rows AS (
    SELECT
      c.card_id,
      c.list_id,
      COALESCE(l.title, 'Lista') AS list_title,
      LEFT(COALESCE(fc.term, ''), 180) AS term,
      LEFT(COALESCE(fc.translation, ''), 180) AS translation,
      SUM(c.view_count)::integer AS views,
      SUM(c.answer_count)::integer AS answers,
      SUM(c.correct_count)::integer AS correct,
      SUM(c.incorrect_count)::integer AS incorrect,
      COUNT(DISTINCT COALESCE(s.user_id::text, s.visitor_hash))::integer AS unique_visitors
    FROM public.turma_engagement_cards c
    JOIN filtered_sessions s ON s.id = c.session_id
    LEFT JOIN public.flashcards fc ON fc.id = c.card_id
    LEFT JOIN public.lists l ON l.id = c.list_id
    GROUP BY c.card_id, c.list_id, l.title, fc.term, fc.translation
    ORDER BY SUM(c.view_count) DESC, COUNT(DISTINCT s.id) DESC
    LIMIT 12
  ),
  daily_rows AS (
    SELECT
      (s.last_activity_at AT TIME ZONE 'UTC')::date AS activity_date,
      COUNT(DISTINCT s.id)::integer AS sessions,
      COUNT(DISTINCT COALESCE(s.user_id::text, s.visitor_hash))::integer AS unique_visitors,
      COALESCE(SUM(ct.card_views), 0)::integer AS card_views
    FROM filtered_sessions s
    LEFT JOIN card_totals ct ON ct.session_id = s.id
    GROUP BY (s.last_activity_at AT TIME ZONE 'UTC')::date
    ORDER BY activity_date
  )
  SELECT jsonb_build_object(
    'period_days', v_days,
    'generated_at', now(),
    'summary', jsonb_build_object(
      'registered_visitors', COALESCE(sr.registered_visitors, 0),
      'guest_visitors', COALESCE(sr.guest_visitors, 0),
      'total_visitors', COALESCE(sr.registered_visitors, 0) + COALESCE(sr.guest_visitors, 0),
      'sessions', COALESCE(sr.sessions, 0),
      'completed_sessions', COALESCE(sr.completed_sessions, 0),
      'card_views', COALESCE(sr.card_views, 0),
      'answers', COALESCE(sr.answers, 0),
      'correct_rate', CASE
        WHEN COALESCE(sr.answers, 0) = 0 THEN NULL
        ELSE ROUND((sr.correct::numeric / sr.answers::numeric) * 100, 1)
      END,
      'last_activity_at', sr.last_activity_at
    ),
    'students', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM student_rows x), '[]'::jsonb),
    'top_lists', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM list_rows x), '[]'::jsonb),
    'top_cards', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM card_rows x), '[]'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM daily_rows x), '[]'::jsonb)
  )
  INTO v_result
  FROM summary_row sr;

  RETURN COALESCE(v_result, jsonb_build_object(
    'period_days', v_days,
    'generated_at', now(),
    'summary', jsonb_build_object(
      'registered_visitors', 0,
      'guest_visitors', 0,
      'total_visitors', 0,
      'sessions', 0,
      'completed_sessions', 0,
      'card_views', 0,
      'answers', 0,
      'correct_rate', NULL,
      'last_activity_at', NULL
    ),
    'students', '[]'::jsonb,
    'top_lists', '[]'::jsonb,
    'top_cards', '[]'::jsonb,
    'daily', '[]'::jsonb
  ));
END;
$$;

REVOKE ALL ON public.turma_engagement_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.turma_engagement_cards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.turma_engagement_sessions TO authenticated;
GRANT SELECT ON public.turma_engagement_cards TO authenticated;

REVOKE ALL ON FUNCTION public.record_turma_engagement_v1(uuid, uuid, uuid, text, text, text, uuid, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_turma_engagement_report_v1(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_turma_engagement_v1(uuid, uuid, uuid, text, text, text, uuid, boolean, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_turma_engagement_report_v1(uuid, integer) TO authenticated;

COMMENT ON TABLE public.turma_engagement_sessions IS
  'Privacy-preserving classroom study sessions. Guest browser tokens are stored only as SHA-256 hashes.';
COMMENT ON FUNCTION public.record_turma_engagement_v1(uuid, uuid, uuid, text, text, text, uuid, boolean, uuid) IS
  'Records public or member classroom engagement without exposing guest identities.';
COMMENT ON FUNCTION public.get_turma_engagement_report_v1(uuid, integer) IS
  'Returns a lightweight owner-only report with student activity, anonymous visitor counts and popular content.';
