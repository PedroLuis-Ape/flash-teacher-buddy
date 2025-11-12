-- Drop existing restrictive policies on subscriptions
DROP POLICY IF EXISTS "Prevent self subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Students can subscribe to teachers" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_delete_student" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select_student" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select_teacher" ON public.subscriptions;

-- Create comprehensive RLS policies for subscriptions
-- Teachers can view their students
CREATE POLICY "Teachers can view their students"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- Students can view their subscriptions
CREATE POLICY "Students can view their subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Students can subscribe to teachers (but not themselves)
CREATE POLICY "Students can subscribe to teachers"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid() 
  AND teacher_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = teacher_id 
    AND COALESCE(public_access_enabled, false) = true
  )
);

-- Students can unsubscribe
CREATE POLICY "Students can delete their subscriptions"
ON public.subscriptions
FOR DELETE
TO authenticated
USING (student_id = auth.uid());

-- Prevent self-subscription via constraint
ALTER TABLE public.subscriptions 
DROP CONSTRAINT IF EXISTS no_self_subscription;

ALTER TABLE public.subscriptions
ADD CONSTRAINT no_self_subscription 
CHECK (teacher_id <> student_id);