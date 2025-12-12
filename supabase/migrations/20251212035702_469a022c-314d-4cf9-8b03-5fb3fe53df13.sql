-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;

-- Create proper access policies for profiles

-- Users can always view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Users can view profiles of teachers they are subscribed to
CREATE POLICY "Students can view their teachers profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriptions.student_id = auth.uid()
      AND subscriptions.teacher_id = profiles.id
  )
);

-- Teachers can view profiles of their subscribed students
CREATE POLICY "Teachers can view their students profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriptions.teacher_id = auth.uid()
      AND subscriptions.student_id = profiles.id
  )
);

-- Teachers can view profiles of students in their turmas
CREATE POLICY "Teachers can view turma member profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.turma_membros tm
    JOIN public.turmas t ON t.id = tm.turma_id
    WHERE t.owner_teacher_id = auth.uid()
      AND tm.user_id = profiles.id
      AND tm.ativo = true
  )
);

-- Students can view profiles of other members in their turmas (including teacher)
CREATE POLICY "Turma members can view each other profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.turma_membros my_membership
    JOIN public.turma_membros other_membership ON my_membership.turma_id = other_membership.turma_id
    WHERE my_membership.user_id = auth.uid()
      AND my_membership.ativo = true
      AND other_membership.user_id = profiles.id
      AND other_membership.ativo = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.turma_membros tm
    JOIN public.turmas t ON t.id = tm.turma_id
    WHERE tm.user_id = auth.uid()
      AND tm.ativo = true
      AND t.owner_teacher_id = profiles.id
  )
);

-- Public teacher profiles (for discovery/subscription) - only expose teachers with public_access_enabled
CREATE POLICY "Public teacher profiles are discoverable"
ON public.profiles FOR SELECT
USING (
  public_access_enabled = true 
  AND is_teacher = true
  AND auth.uid() IS NOT NULL
);