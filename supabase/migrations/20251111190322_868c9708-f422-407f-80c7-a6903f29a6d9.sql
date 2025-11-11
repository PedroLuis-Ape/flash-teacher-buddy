-- ========================================
-- MVP 1: Turmas + Mensagem 1:1
-- Atualizar estrutura existente + novas tabelas
-- ========================================

-- 1. Atualizar tabela de turmas existente
-- Renomear invite_code para code se necessário
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'classes'
      AND column_name = 'invite_code'
  ) THEN
    ALTER TABLE public.classes RENAME COLUMN invite_code TO code;
  END IF;
END $$;

-- Adicionar colunas que faltam em classes
ALTER TABLE public.classes 
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'code',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Adicionar CHECK constraint para visibility se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'classes_visibility_check'
  ) THEN
    ALTER TABLE public.classes 
      ADD CONSTRAINT classes_visibility_check CHECK (visibility IN ('private', 'code'));
  END IF;
END $$;

-- Adicionar constraint de nome se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'name_length'
  ) THEN
    ALTER TABLE public.classes 
      ADD CONSTRAINT name_length CHECK (char_length(name) >= 3 AND char_length(name) <= 100);
  END IF;
END $$;

-- Criar índices para classes
CREATE INDEX IF NOT EXISTS idx_classes_owner ON public.classes(owner_id);
CREATE INDEX IF NOT EXISTS idx_classes_code ON public.classes(code);

-- 2. Atualizar tabela class_members - adicionar coluna status
ALTER TABLE public.class_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Adicionar CHECK constraint para status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'class_members_status_check'
  ) THEN
    ALTER TABLE public.class_members 
      ADD CONSTRAINT class_members_status_check CHECK (status IN ('active', 'suspended'));
  END IF;
END $$;

-- Criar índices para class_members
CREATE INDEX IF NOT EXISTS idx_class_members_user ON public.class_members(user_id);
CREATE INDEX IF NOT EXISTS idx_class_members_class ON public.class_members(class_id);

-- 3. Criar tabela de threads (conversas)
CREATE TABLE IF NOT EXISTS public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'dm' CHECK (type = 'dm'),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT different_users CHECK (user_a_id <> user_b_id),
  CONSTRAINT ordered_users CHECK (user_a_id < user_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_unique_dm ON public.threads(class_id, user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_threads_class ON public.threads(class_id);

-- 4. Criar tabela de mensagens
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  client_msg_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT body_not_empty CHECK (char_length(trim(body)) > 0),
  CONSTRAINT body_max_length CHECK (char_length(body) <= 5000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(sender_id, client_msg_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(thread_id, created_at DESC);

-- 5. Criar tabela de recibos de leitura
CREATE TABLE IF NOT EXISTS public.read_receipts (
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_user ON public.read_receipts(user_id);

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;

-- Threads policies
DROP POLICY IF EXISTS "Thread participants can view threads" ON public.threads;
CREATE POLICY "Thread participants can view threads"
  ON public.threads FOR SELECT
  USING (
    user_a_id = auth.uid() OR
    user_b_id = auth.uid()
  );

DROP POLICY IF EXISTS "Active class members can create threads" ON public.threads;
CREATE POLICY "Active class members can create threads"
  ON public.threads FOR INSERT
  WITH CHECK (
    (user_a_id = auth.uid() OR user_b_id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.class_members
      WHERE class_id = threads.class_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Messages policies
DROP POLICY IF EXISTS "Thread participants can view messages" ON public.messages;
CREATE POLICY "Thread participants can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.threads
      WHERE id = messages.thread_id
        AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Thread participants can send messages" ON public.messages;
CREATE POLICY "Thread participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.threads
      WHERE id = messages.thread_id
        AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );

-- Read receipts policies
DROP POLICY IF EXISTS "Users can view read receipts in their threads" ON public.read_receipts;
CREATE POLICY "Users can view read receipts in their threads"
  ON public.read_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.threads
      WHERE id = read_receipts.thread_id
        AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own read receipts" ON public.read_receipts;
CREATE POLICY "Users can insert their own read receipts"
  ON public.read_receipts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own read receipts" ON public.read_receipts;
CREATE POLICY "Users can update their own read receipts"
  ON public.read_receipts FOR UPDATE
  USING (user_id = auth.uid());

-- ========================================
-- Helper functions
-- ========================================

-- Função para gerar código único de turma (usar coluna 'code' renomeada)
CREATE OR REPLACE FUNCTION public.generate_class_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Gera código no formato APE-XXXX (4 chars alfanuméricos)
    new_code := 'APE-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 4));
    
    -- Verifica se já existe
    SELECT EXISTS(
      SELECT 1 FROM public.classes
      WHERE code = new_code AND archived_at IS NULL
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;