
-- 1) Remove broad cross-user profile SELECT policies (use safe RPCs instead)
DROP POLICY IF EXISTS "Students can view their teachers profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view subscribed students" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view their students profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view turma member profiles" ON public.profiles;

-- 2) Restrict turma creation to professors / developer admins
DROP POLICY IF EXISTS "Teachers can insert their own turmas" ON public.turmas;
CREATE POLICY "Teachers can insert their own turmas"
ON public.turmas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_teacher_id
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'professor'
    )
    OR public.is_developer_admin(auth.uid())
  )
);

-- 3) Restrict institution creation to professors / developer admins
DROP POLICY IF EXISTS "Users can create their own institutions" ON public.institutions;
CREATE POLICY "Users can create their own institutions"
ON public.institutions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'professor'
    )
    OR public.is_developer_admin(auth.uid())
  )
);
