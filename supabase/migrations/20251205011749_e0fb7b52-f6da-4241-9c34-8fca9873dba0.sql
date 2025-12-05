-- Add INSERT policy for dms table to allow turma owners and members to create DMs
CREATE POLICY "Turma owners can create DMs"
ON public.dms FOR INSERT
WITH CHECK (
  is_turma_owner(turma_id, auth.uid()) 
  OR is_turma_member(turma_id, auth.uid())
);

-- Add SELECT policy for dms table
CREATE POLICY "Users can view their DMs"
ON public.dms FOR SELECT
USING (
  teacher_id = auth.uid() 
  OR aluno_id = auth.uid()
);