-- Tabela para salvar progresso das sessões de estudo
CREATE TABLE public.study_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('flip', 'multiple-choice', 'write')),
  current_index INTEGER NOT NULL DEFAULT 0,
  cards_order JSONB NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para rastrear progresso individual de cada flashcard
CREATE TABLE public.flashcard_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, flashcard_id)
);

-- Enable RLS
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies para study_sessions
CREATE POLICY "Users can view their own study sessions"
ON public.study_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own study sessions"
ON public.study_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own study sessions"
ON public.study_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study sessions"
ON public.study_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policies para flashcard_progress
CREATE POLICY "Users can view their own flashcard progress"
ON public.flashcard_progress
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own flashcard progress"
ON public.flashcard_progress
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flashcard progress"
ON public.flashcard_progress
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_study_sessions_updated_at
BEFORE UPDATE ON public.study_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_flashcard_progress_updated_at
BEFORE UPDATE ON public.flashcard_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_study_sessions_user_list ON public.study_sessions(user_id, list_id);
CREATE INDEX idx_flashcard_progress_user_flashcard ON public.flashcard_progress(user_id, flashcard_id);
CREATE INDEX idx_flashcard_progress_next_review ON public.flashcard_progress(next_review);