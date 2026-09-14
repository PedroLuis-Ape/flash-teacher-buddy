ALTER TABLE public.user_study_preferences ADD COLUMN IF NOT EXISTS play_target text;
ALTER TABLE public.user_list_study_preferences ADD COLUMN IF NOT EXISTS play_target text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_study_preferences_play_target_check'
  ) THEN
    ALTER TABLE public.user_study_preferences
      ADD CONSTRAINT user_study_preferences_play_target_check
      CHECK (play_target IS NULL OR play_target IN ('both','prompt','answer'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_list_study_preferences_play_target_check'
  ) THEN
    ALTER TABLE public.user_list_study_preferences
      ADD CONSTRAINT user_list_study_preferences_play_target_check
      CHECK (play_target IS NULL OR play_target IN ('both','prompt','answer'));
  END IF;
END $$;

UPDATE public.user_study_preferences
SET play_target = CASE
  WHEN play_mode IS DISTINCT FROM 'single' THEN 'both'
  WHEN play_side IS NULL THEN 'prompt'
  WHEN play_side = (CASE WHEN direction = 'b-a' THEN 'b' ELSE 'a' END) THEN 'prompt'
  ELSE 'answer'
END
WHERE play_target IS NULL AND (play_mode IS NOT NULL OR play_side IS NOT NULL);

UPDATE public.user_list_study_preferences
SET play_target = CASE
  WHEN play_mode IS DISTINCT FROM 'single' THEN 'both'
  WHEN play_side IS NULL THEN 'prompt'
  WHEN play_side = (CASE WHEN direction = 'b-a' THEN 'b' ELSE 'a' END) THEN 'prompt'
  ELSE 'answer'
END
WHERE play_target IS NULL AND (play_mode IS NOT NULL OR play_side IS NOT NULL);