-- Modo Reino: tabelas para kingdoms, activities e progresso

-- Tabela de reinos
CREATE TABLE IF NOT EXISTS public.kingdoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- K1, K2, K3
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  icon_url TEXT,
  unlock_rule JSONB, -- {requires_xp: 800, requires_accuracy: 80, requires_kingdom: 'K1'}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de atividades do reino
CREATE TABLE IF NOT EXISTS public.kingdom_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kingdom_code TEXT NOT NULL REFERENCES public.kingdoms(code) ON DELETE CASCADE,
  level_code TEXT NOT NULL, -- L1, L2, etc
  unit TEXT, -- tema/tópico (ex: Greetings)
  activity_type TEXT NOT NULL, -- translate, multiple_choice, dictation, fill_blank, order_words, match
  prompt TEXT NOT NULL,
  hint TEXT, -- extraído de ()
  canonical_answer TEXT NOT NULL,
  alt_answers JSONB, -- array de alternativas aceitas
  choices JSONB, -- para multiple_choice
  lang TEXT NOT NULL DEFAULT 'en-US', -- para TTS
  points INTEGER, -- se null, usar tabela base x2
  tags TEXT[], -- array de tags
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kingdom_code, level_code, activity_type, prompt)
);

-- Progresso do usuário em cada reino
CREATE TABLE IF NOT EXISTS public.kingdom_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kingdom_code TEXT NOT NULL REFERENCES public.kingdoms(code) ON DELETE CASCADE,
  completed_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  accuracy_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, kingdom_code)
);

-- Progresso por atividade
CREATE TABLE IF NOT EXISTS public.activity_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.kingdom_activities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new', -- new, done, perfect
  best_score INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_answer_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_kingdom_activities_code ON public.kingdom_activities(kingdom_code);
CREATE INDEX IF NOT EXISTS idx_kingdom_activities_type ON public.kingdom_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_kingdom_progress_user ON public.kingdom_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_user ON public.activity_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_activity ON public.activity_progress(activity_id);

-- RLS Policies
ALTER TABLE public.kingdoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kingdom_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kingdom_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_progress ENABLE ROW LEVEL SECURITY;

-- Todos podem ver reinos
CREATE POLICY "Anyone can view kingdoms"
  ON public.kingdoms FOR SELECT
  USING (true);

-- Apenas developer_admin pode gerenciar reinos
CREATE POLICY "Developer admin can manage kingdoms"
  ON public.kingdoms FOR ALL
  USING (is_developer_admin(auth.uid()))
  WITH CHECK (is_developer_admin(auth.uid()));

-- Todos autenticados podem ver atividades
CREATE POLICY "Authenticated users can view activities"
  ON public.kingdom_activities FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Apenas developer_admin pode gerenciar atividades
CREATE POLICY "Developer admin can manage activities"
  ON public.kingdom_activities FOR ALL
  USING (is_developer_admin(auth.uid()))
  WITH CHECK (is_developer_admin(auth.uid()));

-- Usuários veem apenas seu progresso
CREATE POLICY "Users can view own kingdom progress"
  ON public.kingdom_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own kingdom progress"
  ON public.kingdom_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuários veem apenas seu progresso de atividades
CREATE POLICY "Users can view own activity progress"
  ON public.activity_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own activity progress"
  ON public.activity_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seed dos 3 reinos
INSERT INTO public.kingdoms (code, name, order_index, unlock_rule) VALUES
  ('K1', 'Reino 1', 1, '{"unlocked": true}'::jsonb),
  ('K2', 'Reino 2', 2, '{"requires_xp": 800, "requires_accuracy": 80, "requires_kingdom": "K1"}'::jsonb),
  ('K3', 'Reino 3', 3, '{"requires_kingdom": "K2"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Seed de atividades de teste (opcional, pode ser removido depois)
INSERT INTO public.kingdom_activities (kingdom_code, level_code, unit, activity_type, prompt, hint, canonical_answer, alt_answers, lang, points) VALUES
  ('K1', 'L1', 'Greetings', 'translate', 'Hello', 'cumprimento padrão', 'Hello', '["Hi", "Hello there"]'::jsonb, 'en-US', NULL),
  ('K1', 'L1', 'Be-verb', 'multiple_choice', 'I ___ Pedro', NULL, 'I am', '["I''m"]'::jsonb, 'en-US', NULL),
  ('K1', 'L1', 'Feelings', 'translate', 'I am happy', 'estado emocional', 'I am happy', '["I''m happy"]'::jsonb, 'en-US', NULL)
ON CONFLICT (kingdom_code, level_code, activity_type, prompt) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_kingdoms_updated_at
  BEFORE UPDATE ON public.kingdoms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kingdom_activities_updated_at
  BEFORE UPDATE ON public.kingdom_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kingdom_progress_updated_at
  BEFORE UPDATE ON public.kingdom_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activity_progress_updated_at
  BEFORE UPDATE ON public.activity_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();