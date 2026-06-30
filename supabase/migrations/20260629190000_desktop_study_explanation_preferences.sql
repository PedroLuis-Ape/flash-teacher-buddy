-- Persistent desktop explanation preferences per user and study scope.

CREATE TABLE IF NOT EXISTS public.user_study_explanation_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('list', 'collection')),
  scope_id uuid NOT NULL,
  display_mode text NOT NULL DEFAULT 'on_demand'
    CHECK (display_mode IN ('off', 'on_demand', 'always')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS public.user_study_explanation_cards (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('list', 'collection')),
  scope_id uuid NOT NULL,
  card_key text NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope_type, scope_id, card_key)
);

ALTER TABLE public.user_study_explanation_preferences
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_study_explanation_cards
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_study_explanation_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_study_explanation_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own study explanation preferences"
  ON public.user_study_explanation_preferences;
CREATE POLICY "Users manage their own study explanation preferences"
  ON public.user_study_explanation_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own study explanation cards"
  ON public.user_study_explanation_cards;
CREATE POLICY "Users manage their own study explanation cards"
  ON public.user_study_explanation_cards
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_study_explanation_preferences_scope
  ON public.user_study_explanation_preferences (user_id, scope_type, scope_id);

CREATE INDEX IF NOT EXISTS idx_user_study_explanation_cards_scope
  ON public.user_study_explanation_cards (user_id, scope_type, scope_id, is_open);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_study_explanation_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_study_explanation_cards TO authenticated;
GRANT ALL ON public.user_study_explanation_preferences TO service_role;
GRANT ALL ON public.user_study_explanation_cards TO service_role;
