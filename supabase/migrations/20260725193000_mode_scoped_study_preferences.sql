BEGIN;

ALTER TABLE public.user_study_preferences
  ADD COLUMN IF NOT EXISTS game_mode text;

UPDATE public.user_study_preferences
SET game_mode = COALESCE(game_mode, mode, 'flip')
WHERE game_mode IS NULL;

ALTER TABLE public.user_study_preferences
  ALTER COLUMN game_mode SET DEFAULT 'flip',
  ALTER COLUMN game_mode SET NOT NULL;

ALTER TABLE public.user_study_preferences
  DROP CONSTRAINT IF EXISTS user_study_preferences_game_mode_check;
ALTER TABLE public.user_study_preferences
  ADD CONSTRAINT user_study_preferences_game_mode_check
  CHECK (game_mode IN ('flip', 'write', 'multiple-choice', 'unscramble', 'mixed', 'pronunciation'));

ALTER TABLE public.user_study_preferences
  DROP CONSTRAINT IF EXISTS user_study_preferences_pkey;
ALTER TABLE public.user_study_preferences
  ADD CONSTRAINT user_study_preferences_pkey PRIMARY KEY (user_id, game_mode);

ALTER TABLE public.user_list_study_preferences
  ADD COLUMN IF NOT EXISTS game_mode text;

UPDATE public.user_list_study_preferences AS list_pref
SET game_mode = COALESCE(
  list_pref.game_mode,
  list_pref.mode,
  global_pref.mode,
  'flip'
)
FROM public.user_study_preferences AS global_pref
WHERE list_pref.user_id = global_pref.user_id
  AND list_pref.game_mode IS NULL;

UPDATE public.user_list_study_preferences
SET game_mode = COALESCE(game_mode, mode, 'flip')
WHERE game_mode IS NULL;

ALTER TABLE public.user_list_study_preferences
  ALTER COLUMN game_mode SET DEFAULT 'flip',
  ALTER COLUMN game_mode SET NOT NULL;

ALTER TABLE public.user_list_study_preferences
  DROP CONSTRAINT IF EXISTS user_list_study_preferences_game_mode_check;
ALTER TABLE public.user_list_study_preferences
  ADD CONSTRAINT user_list_study_preferences_game_mode_check
  CHECK (game_mode IN ('flip', 'write', 'multiple-choice', 'unscramble', 'mixed', 'pronunciation'));

ALTER TABLE public.user_list_study_preferences
  DROP CONSTRAINT IF EXISTS user_list_study_preferences_pkey;
ALTER TABLE public.user_list_study_preferences
  ADD CONSTRAINT user_list_study_preferences_pkey PRIMARY KEY (user_id, list_id, game_mode);

CREATE INDEX IF NOT EXISTS idx_user_study_preferences_user_mode_updated
  ON public.user_study_preferences(user_id, game_mode, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_list_study_preferences_user_list_mode_updated
  ON public.user_list_study_preferences(user_id, list_id, game_mode, updated_at DESC);

COMMIT;

NOTIFY pgrst, 'reload schema';
