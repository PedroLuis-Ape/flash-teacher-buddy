-- Ensure RLS policies for subscriptions allow student inserts and proper access
-- 1) Enable RLS (safe if already enabled)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 2) Drop potentially conflicting existing policies to recreate cleanly
DROP POLICY IF EXISTS "Students can subscribe to teachers" ON public.subscriptions;
DROP POLICY IF EXISTS "Prevent self subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select_teacher" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select_student" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_delete_student" ON public.subscriptions;

-- 3) Recreate policies with explicit TO authenticated scope
CREATE POLICY "Students can subscribe to teachers"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND teacher_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = public.subscriptions.teacher_id
      AND COALESCE(p.public_access_enabled, false) = true
  )
);

CREATE POLICY "Prevent self subscription"
ON public.subscriptions
FOR ALL
TO authenticated
USING (teacher_id <> student_id)
WITH CHECK (teacher_id <> student_id);

CREATE POLICY "subs_select_student"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "subs_select_teacher"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "subs_delete_student"
ON public.subscriptions
FOR DELETE
TO authenticated
USING (student_id = auth.uid());