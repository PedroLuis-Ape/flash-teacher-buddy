-- =====================================================
-- METAS DE TURMA (Class Goals) - Separate from user_goals
-- =====================================================

-- 1. Enum for target type
DO $$ BEGIN
  CREATE TYPE public.class_goal_target_type AS ENUM ('folder', 'list');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Enum for assignment status
DO $$ BEGIN
  CREATE TYPE public.class_goal_assignment_status AS ENUM ('assigned', 'submitted', 'approved', 'needs_revision');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Main class_goals table
CREATE TABLE IF NOT EXISTS public.class_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL
);

-- 4. class_goal_targets table (defines what needs to be studied)
CREATE TABLE IF NOT EXISTS public.class_goal_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.class_goals(id) ON DELETE CASCADE,
  target_type public.class_goal_target_type NOT NULL,
  target_id UUID NOT NULL,
  percent_required INTEGER NOT NULL DEFAULT 50 CHECK (percent_required > 0 AND percent_required <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. class_goal_assignments table (tracks each student's progress)
CREATE TABLE IF NOT EXISTS public.class_goal_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.class_goals(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL,
  status public.class_goal_assignment_status NOT NULL DEFAULT 'assigned',
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(goal_id, aluno_id)
);

-- 6. Enable RLS
ALTER TABLE public.class_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_goal_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_goal_assignments ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for class_goals
-- Teachers can manage goals in their turmas
CREATE POLICY "Teachers can manage class goals"
ON public.class_goals
FOR ALL
USING (is_turma_owner(turma_id, auth.uid()))
WITH CHECK (is_turma_owner(turma_id, auth.uid()));

-- Students can view goals in turmas they belong to
CREATE POLICY "Students can view class goals in their turmas"
ON public.class_goals
FOR SELECT
USING (is_turma_member(turma_id, auth.uid()));

-- 8. RLS Policies for class_goal_targets
-- Teachers can manage targets
CREATE POLICY "Teachers can manage class goal targets"
ON public.class_goal_targets
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.class_goals g 
  WHERE g.id = class_goal_targets.goal_id 
  AND is_turma_owner(g.turma_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.class_goals g 
  WHERE g.id = class_goal_targets.goal_id 
  AND is_turma_owner(g.turma_id, auth.uid())
));

-- Students can view targets for their goals
CREATE POLICY "Students can view class goal targets"
ON public.class_goal_targets
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.class_goals g 
  WHERE g.id = class_goal_targets.goal_id 
  AND is_turma_member(g.turma_id, auth.uid())
));

-- 9. RLS Policies for class_goal_assignments
-- Teachers can view all assignments in their turmas
CREATE POLICY "Teachers can view all assignments in their turmas"
ON public.class_goal_assignments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.class_goals g 
  WHERE g.id = class_goal_assignments.goal_id 
  AND is_turma_owner(g.turma_id, auth.uid())
));

-- Teachers can manage assignments
CREATE POLICY "Teachers can manage assignments"
ON public.class_goal_assignments
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.class_goals g 
  WHERE g.id = class_goal_assignments.goal_id 
  AND is_turma_owner(g.turma_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.class_goals g 
  WHERE g.id = class_goal_assignments.goal_id 
  AND is_turma_owner(g.turma_id, auth.uid())
));

-- Students can view their own assignments
CREATE POLICY "Students can view their own assignments"
ON public.class_goal_assignments
FOR SELECT
USING (aluno_id = auth.uid());

-- Students can update their own assignments (submit only)
CREATE POLICY "Students can submit their assignments"
ON public.class_goal_assignments
FOR UPDATE
USING (aluno_id = auth.uid() AND status IN ('assigned', 'needs_revision'))
WITH CHECK (aluno_id = auth.uid());

-- 10. Triggers for updated_at
CREATE TRIGGER update_class_goals_updated_at
  BEFORE UPDATE ON public.class_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_goal_assignments_updated_at
  BEFORE UPDATE ON public.class_goal_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_goals_turma_id ON public.class_goals(turma_id);
CREATE INDEX IF NOT EXISTS idx_class_goal_targets_goal_id ON public.class_goal_targets(goal_id);
CREATE INDEX IF NOT EXISTS idx_class_goal_assignments_goal_id ON public.class_goal_assignments(goal_id);
CREATE INDEX IF NOT EXISTS idx_class_goal_assignments_aluno_id ON public.class_goal_assignments(aluno_id);