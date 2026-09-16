-- Reescrever (reescrita visual) x Escrever o que ouviu (ditado).
-- Additive only: presets/linhas antigas continuam válidas. Sem o campo, o
-- valor vale como "visible" — a reescrita visual original do modo, que o
-- ditado havia substituído.
BEGIN;

ALTER TABLE public.user_study_preferences
  ADD COLUMN IF NOT EXISTS write_rewrite_prompt_mode text NOT NULL DEFAULT 'visible';

ALTER TABLE public.user_list_study_preferences
  ADD COLUMN IF NOT EXISTS write_rewrite_prompt_mode text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_study_preferences_write_rewrite_prompt_mode_check') THEN
    ALTER TABLE public.user_study_preferences ADD CONSTRAINT user_study_preferences_write_rewrite_prompt_mode_check
      CHECK (write_rewrite_prompt_mode IN ('visible', 'listening'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_list_study_preferences_write_rewrite_prompt_mode_check') THEN
    ALTER TABLE public.user_list_study_preferences ADD CONSTRAINT user_list_study_preferences_write_rewrite_prompt_mode_check
      CHECK (write_rewrite_prompt_mode IS NULL OR write_rewrite_prompt_mode IN ('visible', 'listening'));
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

