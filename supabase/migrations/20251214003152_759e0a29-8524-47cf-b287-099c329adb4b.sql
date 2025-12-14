-- ============================================
-- TABELA: turma_student_activity
-- Rastreia atividade de alunos por turma em tempo real
-- ============================================

CREATE TABLE public.turma_student_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  list_id uuid REFERENCES public.lists(id) ON DELETE SET NULL,
  mode text,
  progress_pct integer DEFAULT 0,
  last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(turma_id, student_id)
);

-- Enable RLS
ALTER TABLE public.turma_student_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. Aluno pode INSERT/UPDATE apenas da própria linha
CREATE POLICY "Students can insert their own activity"
ON public.turma_student_activity
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own activity"
ON public.turma_student_activity
FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- 2. Professor (dono da turma) pode SELECT das linhas da turma
CREATE POLICY "Teachers can view activity in their turmas"
ON public.turma_student_activity
FOR SELECT
USING (
  is_turma_owner(turma_id, auth.uid()) 
  OR auth.uid() = student_id
);

-- Trigger para updated_at
CREATE TRIGGER update_turma_student_activity_updated_at
BEFORE UPDATE ON public.turma_student_activity
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.turma_student_activity;

-- Index for fast lookups
CREATE INDEX idx_turma_student_activity_turma_id ON public.turma_student_activity(turma_id);
CREATE INDEX idx_turma_student_activity_last_activity ON public.turma_student_activity(last_activity_at DESC);