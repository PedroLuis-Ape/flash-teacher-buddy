BEGIN;

-- get_lists_with_card_counts joins from lists into user_list_activity using
-- list_id first and user_id second. The primary key is ordered the opposite
-- way (user_id, list_id), so this covering index avoids repeated scans when a
-- folder contains many lists.
CREATE INDEX IF NOT EXISTS idx_user_list_activity_list_user
ON public.user_list_activity(list_id, user_id);

-- Wrap auth.uid() in a scalar SELECT so Postgres can evaluate it once per
-- statement instead of once per row while preserving the exact ownership
-- semantics of the existing policies.
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
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own activity"
ON public.user_list_activity
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own activity"
ON public.user_list_activity
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

COMMIT;

NOTIFY pgrst, 'reload schema';
