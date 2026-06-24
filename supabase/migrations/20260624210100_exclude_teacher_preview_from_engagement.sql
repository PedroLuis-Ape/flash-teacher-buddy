ALTER FUNCTION public.record_turma_engagement_v1(
  uuid, uuid, uuid, text, text, text, uuid, boolean, uuid
) RENAME TO record_turma_engagement_internal_v1;

REVOKE ALL ON FUNCTION public.record_turma_engagement_internal_v1(
  uuid, uuid, uuid, text, text, text, uuid, boolean, uuid
) FROM PUBLIC, anon, authenticated;

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
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.id = _turma_id
      AND t.owner_teacher_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'recorded', false,
      'actor_type', 'teacher_preview'
    );
  END IF;

  RETURN public.record_turma_engagement_internal_v1(
    _turma_id,
    _list_id,
    _session_token,
    _visitor_token,
    _event_type,
    _mode,
    _card_id,
    _correct,
    _atribuicao_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_turma_engagement_v1(
  uuid, uuid, uuid, text, text, text, uuid, boolean, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_turma_engagement_v1(
  uuid, uuid, uuid, text, text, text, uuid, boolean, uuid
) TO anon, authenticated;

COMMENT ON FUNCTION public.record_turma_engagement_v1(
  uuid, uuid, uuid, text, text, text, uuid, boolean, uuid
) IS 'Records classroom engagement while excluding classroom-owner preview sessions from student-interest totals.';
