BEGIN;

ALTER TABLE public.user_study_preferences
  ADD COLUMN IF NOT EXISTS play_mode text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS play_side text NOT NULL DEFAULT 'a';

ALTER TABLE public.user_list_study_preferences
  ADD COLUMN IF NOT EXISTS play_mode text NULL,
  ADD COLUMN IF NOT EXISTS play_side text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_study_preferences_play_mode_check'
      AND conrelid = 'public.user_study_preferences'::regclass
  ) THEN
    ALTER TABLE public.user_study_preferences
      ADD CONSTRAINT user_study_preferences_play_mode_check
      CHECK (play_mode IN ('both', 'single'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_study_preferences_play_side_check'
      AND conrelid = 'public.user_study_preferences'::regclass
  ) THEN
    ALTER TABLE public.user_study_preferences
      ADD CONSTRAINT user_study_preferences_play_side_check
      CHECK (play_side IN ('a', 'b'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_list_study_preferences_play_mode_check'
      AND conrelid = 'public.user_list_study_preferences'::regclass
  ) THEN
    ALTER TABLE public.user_list_study_preferences
      ADD CONSTRAINT user_list_study_preferences_play_mode_check
      CHECK (play_mode IS NULL OR play_mode IN ('both', 'single'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_list_study_preferences_play_side_check'
      AND conrelid = 'public.user_list_study_preferences'::regclass
  ) THEN
    ALTER TABLE public.user_list_study_preferences
      ADD CONSTRAINT user_list_study_preferences_play_side_check
      CHECK (play_side IS NULL OR play_side IN ('a', 'b'));
  END IF;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';