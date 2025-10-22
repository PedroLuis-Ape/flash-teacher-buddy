-- Policy to allow teachers to view their subscribed students' profiles
CREATE POLICY "Teachers can view subscribed students"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.student_id = profiles.id
      AND s.teacher_id = auth.uid()
  )
);
