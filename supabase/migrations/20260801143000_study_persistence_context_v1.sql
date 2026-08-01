-- Study persistence context v1.
-- Additive only: legacy rows remain readable, but rows without a context are
-- deliberately ignored by the new restore path until the user starts again.
BEGIN;

ALTER TABLE public.user_study_preferences
  ADD COLUMN IF NOT EXISTS write_activity_mode text NOT NULL DEFAULT 'translate',
  ADD COLUMN IF NOT EXISTS write_rewrite_side text NOT NULL DEFAULT 'alternating',
  ADD COLUMN IF NOT EXISTS write_correction_mode text NOT NULL DEFAULT 'flexible';

ALTER TABLE public.user_list_study_preferences
  ADD COLUMN IF NOT EXISTS write_activity_mode text,
  ADD COLUMN IF NOT EXISTS write_rewrite_side text,
  ADD COLUMN IF NOT EXISTS write_correction_mode text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_study_preferences_write_activity_mode_check') THEN
    ALTER TABLE public.user_study_preferences ADD CONSTRAINT user_study_preferences_write_activity_mode_check
      CHECK (write_activity_mode IN ('translate', 'rewrite'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_study_preferences_write_rewrite_side_check') THEN
    ALTER TABLE public.user_study_preferences ADD CONSTRAINT user_study_preferences_write_rewrite_side_check
      CHECK (write_rewrite_side IN ('a', 'b', 'alternating'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_study_preferences_write_correction_mode_check') THEN
    ALTER TABLE public.user_study_preferences ADD CONSTRAINT user_study_preferences_write_correction_mode_check
      CHECK (write_correction_mode IN ('flexible', 'hard'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_list_study_preferences_write_activity_mode_check') THEN
    ALTER TABLE public.user_list_study_preferences ADD CONSTRAINT user_list_study_preferences_write_activity_mode_check
      CHECK (write_activity_mode IS NULL OR write_activity_mode IN ('translate', 'rewrite'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_list_study_preferences_write_rewrite_side_check') THEN
    ALTER TABLE public.user_list_study_preferences ADD CONSTRAINT user_list_study_preferences_write_rewrite_side_check
      CHECK (write_rewrite_side IS NULL OR write_rewrite_side IN ('a', 'b', 'alternating'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_list_study_preferences_write_correction_mode_check') THEN
    ALTER TABLE public.user_list_study_preferences ADD CONSTRAINT user_list_study_preferences_write_correction_mode_check
      CHECK (write_correction_mode IS NULL OR write_correction_mode IN ('flexible', 'hard'));
  END IF;
END $$;

ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS session_scope_key text,
  ADD COLUMN IF NOT EXISTS settings_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS session_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;

DO $$
DECLARE
  existing_constraint record;
BEGIN
  -- Replace only an old mode allow-list; all other constraints are preserved.
  FOR existing_constraint IN
    SELECT c.conname
    FROM pg_constraint AS c
    JOIN pg_class AS t ON t.oid = c.conrelid
    JOIN pg_namespace AS n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'study_sessions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%mode%'
      AND pg_get_constraintdef(c.oid) ILIKE '%flip%'
      AND pg_get_constraintdef(c.oid) ILIKE '%write%'
  LOOP
    EXECUTE format('ALTER TABLE public.study_sessions DROP CONSTRAINT %I', existing_constraint.conname);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_sessions_mode_check_v1') THEN
    ALTER TABLE public.study_sessions ADD CONSTRAINT study_sessions_mode_check_v1
      CHECK (mode IN ('flip', 'multiple-choice', 'write', 'mixed', 'mixed-adaptive', 'unscramble', 'pronunciation'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_study_sessions_active_scope_v1
  ON public.study_sessions(user_id, list_id, mode, session_scope_key, updated_at DESC)
  WHERE completed = false;

COMMIT;

NOTIFY pgrst, 'reload schema';
