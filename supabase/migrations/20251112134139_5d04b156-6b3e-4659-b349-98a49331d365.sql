-- BLOCO 2: Mensagens e Comunicação

-- Tipo de thread enum
DO $$ BEGIN
  CREATE TYPE thread_tipo AS ENUM ('turma', 'atribuicao', 'dm');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  thread_tipo thread_tipo NOT NULL,
  thread_chave TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL CHECK (char_length(texto) <= 2000),
  anexos JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_mensagens_thread ON public.mensagens(turma_id, thread_tipo, thread_chave, created_at DESC);
CREATE INDEX idx_mensagens_sender ON public.mensagens(sender_id);

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Tabela de DMs (pares professor-aluno)
CREATE TABLE IF NOT EXISTS public.dms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(turma_id, teacher_id, aluno_id)
);

ALTER TABLE public.dms ENABLE ROW LEVEL SECURITY;

-- Tabela de leituras de mensagens
CREATE TABLE IF NOT EXISTS public.mensagens_leituras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lido_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(mensagem_id, user_id)
);

CREATE INDEX idx_mensagens_leituras_user ON public.mensagens_leituras(user_id);
CREATE INDEX idx_mensagens_leituras_msg ON public.mensagens_leituras(mensagem_id);

ALTER TABLE public.mensagens_leituras ENABLE ROW LEVEL SECURITY;

-- Helper: check if user can access thread
CREATE OR REPLACE FUNCTION public.can_access_thread(_turma_id UUID, _thread_tipo thread_tipo, _thread_chave TEXT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be turma member or owner
  IF NOT (is_turma_owner(_turma_id, _user_id) OR is_turma_member(_turma_id, _user_id)) THEN
    RETURN false;
  END IF;
  
  -- For DM threads, must be one of the participants
  IF _thread_tipo = 'dm' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.dms
      WHERE turma_id = _turma_id
        AND id::text = _thread_chave
        AND (teacher_id = _user_id OR aluno_id = _user_id)
    );
  END IF;
  
  -- For turma and atribuicao, being a member is enough
  RETURN true;
END;
$$;

-- RLS POLICIES: mensagens
CREATE POLICY "Members can view messages in their threads"
ON public.mensagens FOR SELECT
USING (
  can_access_thread(turma_id, thread_tipo, thread_chave, auth.uid())
  AND deleted = false
);

CREATE POLICY "Members can send messages in their threads"
ON public.mensagens FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND can_access_thread(turma_id, thread_tipo, thread_chave, auth.uid())
);

CREATE POLICY "Senders can update their own messages"
ON public.mensagens FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders can soft-delete their messages"
ON public.mensagens FOR UPDATE
USING (auth.uid() = sender_id AND deleted = false)
WITH CHECK (auth.uid() = sender_id);

-- RLS POLICIES: dms
CREATE POLICY "DM participants can view their DMs"
ON public.dms FOR SELECT
USING (
  auth.uid() = teacher_id OR auth.uid() = aluno_id
);

CREATE POLICY "Teachers can create DMs with students"
ON public.dms FOR INSERT
WITH CHECK (
  auth.uid() = teacher_id
  AND is_turma_owner(turma_id, teacher_id)
  AND is_turma_member(turma_id, aluno_id)
);

-- RLS POLICIES: mensagens_leituras
CREATE POLICY "Users can view their own read receipts"
ON public.mensagens_leituras FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Teachers can view read receipts in their turmas"
ON public.mensagens_leituras FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mensagens m
    WHERE m.id = mensagens_leituras.mensagem_id
      AND is_turma_owner(m.turma_id, auth.uid())
  )
);

CREATE POLICY "Users can mark messages as read"
ON public.mensagens_leituras FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Rate limiting table for messages
CREATE TABLE IF NOT EXISTS public.message_rate_limits (
  user_id UUID NOT NULL,
  thread_key TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_key)
);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_message_rate_limit(_user_id UUID, _thread_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Get current count and window
  SELECT message_count, window_start
  INTO v_count, v_window_start
  FROM public.message_rate_limits
  WHERE user_id = _user_id AND thread_key = _thread_key;
  
  -- If no record or window expired (1 minute)
  IF NOT FOUND OR (now() - v_window_start) > INTERVAL '1 minute' THEN
    INSERT INTO public.message_rate_limits (user_id, thread_key, message_count, window_start)
    VALUES (_user_id, _thread_key, 1, now())
    ON CONFLICT (user_id, thread_key) 
    DO UPDATE SET message_count = 1, window_start = now();
    RETURN true;
  END IF;
  
  -- Check if limit exceeded (20 messages per minute)
  IF v_count >= 20 THEN
    RETURN false;
  END IF;
  
  -- Increment counter
  UPDATE public.message_rate_limits
  SET message_count = message_count + 1
  WHERE user_id = _user_id AND thread_key = _thread_key;
  
  RETURN true;
END;
$$;