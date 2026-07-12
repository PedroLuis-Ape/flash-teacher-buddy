BEGIN;

CREATE TABLE IF NOT EXISTS public.user_study_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'flip',
  direction text NOT NULL DEFAULT 'any',
  card_order text NOT NULL DEFAULT 'random',
  scope text NOT NULL DEFAULT 'all',
  fast_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_study_preferences_mode_check
    CHECK (mode IN ('flip', 'write', 'multiple-choice', 'unscramble', 'mixed', 'pronunciation')),
  CONSTRAINT user_study_preferences_direction_check
    CHECK (direction IN ('a-b', 'b-a', 'any')),
  CONSTRAINT user_study_preferences_card_order_check
    CHECK (card_order IN ('random', 'sequential')),
  CONSTRAINT user_study_preferences_scope_check
    CHECK (scope IN ('all', 'favorites'))
);

CREATE TABLE IF NOT EXISTS public.user_list_study_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  mode text NULL,
  direction text NULL,
  card_order text NULL,
  scope text NULL,
  fast_mode boolean NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, list_id),
  CONSTRAINT user_list_study_preferences_mode_check
    CHECK (mode IS NULL OR mode IN ('flip', 'write', 'multiple-choice', 'unscramble', 'mixed', 'pronunciation')),
  CONSTRAINT user_list_study_preferences_direction_check
    CHECK (direction IS NULL OR direction IN ('a-b', 'b-a', 'any')),
  CONSTRAINT user_list_study_preferences_card_order_check
    CHECK (card_order IS NULL OR card_order IN ('random', 'sequential')),
  CONSTRAINT user_list_study_preferences_scope_check
    CHECK (scope IS NULL OR scope IN ('all', 'favorites'))
);

CREATE INDEX IF NOT EXISTS idx_user_study_preferences_updated_at
  ON public.user_study_preferences(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_list_study_preferences_list_user
  ON public.user_list_study_preferences(list_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_list_study_preferences_updated_at
  ON public.user_list_study_preferences(updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_study_preference_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_user_study_preferences_updated_at
  ON public.user_study_preferences;
CREATE TRIGGER touch_user_study_preferences_updated_at
BEFORE UPDATE ON public.user_study_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_study_preference_updated_at();

DROP TRIGGER IF EXISTS touch_user_list_study_preferences_updated_at
  ON public.user_list_study_preferences;
CREATE TRIGGER touch_user_list_study_preferences_updated_at
BEFORE UPDATE ON public.user_list_study_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_study_preference_updated_at();

ALTER TABLE public.user_study_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_list_study_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their study preferences"
  ON public.user_study_preferences;
DROP POLICY IF EXISTS "Users can insert their study preferences"
  ON public.user_study_preferences;
DROP POLICY IF EXISTS "Users can update their study preferences"
  ON public.user_study_preferences;
DROP POLICY IF EXISTS "Users can delete their study preferences"
  ON public.user_study_preferences;

CREATE POLICY "Users can view their study preferences"
ON public.user_study_preferences
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their study preferences"
ON public.user_study_preferences
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their study preferences"
ON public.user_study_preferences
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their study preferences"
ON public.user_study_preferences
FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their list study preferences"
  ON public.user_list_study_preferences;
DROP POLICY IF EXISTS "Users can insert their list study preferences"
  ON public.user_list_study_preferences;
DROP POLICY IF EXISTS "Users can update their list study preferences"
  ON public.user_list_study_preferences;
DROP POLICY IF EXISTS "Users can delete their list study preferences"
  ON public.user_list_study_preferences;

CREATE POLICY "Users can view their list study preferences"
ON public.user_list_study_preferences
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their list study preferences"
ON public.user_list_study_preferences
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their list study preferences"
ON public.user_list_study_preferences
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their list study preferences"
ON public.user_list_study_preferences
FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.user_study_preferences FROM anon;
REVOKE ALL ON public.user_list_study_preferences FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_study_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_list_study_preferences TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
