-- Atomic, retry-safe flashcard progress writer for study modes.
-- Additive only: existing flashcard_progress rows and constraints remain.
BEGIN;

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
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

REVOKE ALL ON TABLE public.study_progress_events FROM anon, authenticated;

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_flashcard_id IS NULL OR p_list_id IS NULL OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.study_progress_events
    (user_id, operation_id, flashcard_id, list_id, correct)
  VALUES
    (v_user_id, p_operation_id, p_flashcard_id, p_list_id, p_correct)
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
    (v_user_id, p_flashcard_id, p_list_id,
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
