-- Criar tabela de inscrições (subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, student_id)
);

-- Habilitar RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para subscriptions
-- Professores podem ver quem está inscrito neles
CREATE POLICY "subs_select_teacher"
ON public.subscriptions FOR SELECT
USING (teacher_id = auth.uid());

-- Alunos podem ver em quem estão inscritos
CREATE POLICY "subs_select_student"
ON public.subscriptions FOR SELECT
USING (student_id = auth.uid());

-- Alunos podem se inscrever em professores
CREATE POLICY "subs_insert_student"
ON public.subscriptions FOR INSERT
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = teacher_id AND ur.role = 'owner'
  )
);

-- Alunos podem cancelar suas próprias inscrições
CREATE POLICY "subs_delete_student"
ON public.subscriptions FOR DELETE
USING (student_id = auth.uid());