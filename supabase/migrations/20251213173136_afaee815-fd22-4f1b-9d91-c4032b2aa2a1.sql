-- =============================================
-- SISTEMA DE METAS PESSOAIS (USER GOALS)
-- =============================================

-- Tabela principal de metas
CREATE TABLE public.user_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Etapas de cada meta
CREATE TABLE public.user_goal_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  list_id UUID NOT NULL,
  mode TEXT, -- null = modo livre, ou 'flip', 'write', 'multiple-choice', 'mixed', 'unscramble', 'pronunciation'
  target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count >= 1 AND target_count <= 3),
  current_count INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Anti-duplicação: registra qual sessão já contou para qual etapa
CREATE TABLE public.user_goal_step_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID NOT NULL REFERENCES public.user_goal_steps(id) ON DELETE CASCADE,
  study_session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(step_id, study_session_id)
);

-- Índices para performance
CREATE INDEX idx_user_goals_user_id ON public.user_goals(user_id);
CREATE INDEX idx_user_goals_status ON public.user_goals(status);
CREATE INDEX idx_user_goal_steps_goal_id ON public.user_goal_steps(goal_id);
CREATE INDEX idx_user_goal_steps_list_id ON public.user_goal_steps(list_id);
CREATE INDEX idx_user_goal_step_completions_step_id ON public.user_goal_step_completions(step_id);

-- Enable RLS
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goal_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goal_step_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies para user_goals
CREATE POLICY "Users can view their own goals"
  ON public.user_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals"
  ON public.user_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON public.user_goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON public.user_goals FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para user_goal_steps
CREATE POLICY "Users can view their own goal steps"
  ON public.user_goal_steps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goal steps"
  ON public.user_goal_steps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal steps"
  ON public.user_goal_steps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal steps"
  ON public.user_goal_steps FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para user_goal_step_completions
CREATE POLICY "Users can view their own completions"
  ON public.user_goal_step_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own completions"
  ON public.user_goal_step_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_user_goals_updated_at
  BEFORE UPDATE ON public.user_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_goal_steps_updated_at
  BEFORE UPDATE ON public.user_goal_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();