BEGIN;

CREATE TABLE IF NOT EXISTS public.user_list_activity (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  last_opened_at timestamptz,
  last_studied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, list_id)
);

ALTER TABLE public.user_list_activity ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE public.user_list_activity
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.user_list_activity
TO authenticated;

DROP POLICY IF EXISTS "Users can view their own activity"
ON public.user_list_activity;

DROP POLICY IF EXISTS "Users can insert their own activity"
ON public.user_list_activity;

DROP POLICY IF EXISTS "Users can update their own activity"
ON public.user_list_activity;

CREATE POLICY "Users can view their own activity"
ON public.user_list_activity
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
);

CREATE POLICY "Users can insert their own activity"
ON public.user_list_activity
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
);

CREATE POLICY "Users can update their own activity"
ON public.user_list_activity
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
);

CREATE INDEX IF NOT EXISTS idx_user_list_activity_user_updated
ON public.user_list_activity(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_list_activity_user_studied
ON public.user_list_activity(user_id, last_studied_at DESC NULLS LAST);

COMMIT;

NOTIFY pgrst, 'reload schema';
