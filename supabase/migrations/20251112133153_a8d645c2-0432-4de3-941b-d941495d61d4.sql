-- BLOCO 1: Turmas e Atribuições (MVP)

-- Add ape_id and is_teacher to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ape_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_teacher BOOLEAN DEFAULT false;

-- Function to generate ape_id (8-10 chars alphanumeric)
CREATE OR REPLACE FUNCTION public.generate_ape_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric ID
    new_id := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
    
    -- Check if exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE ape_id = new_id) INTO id_exists;
    
    EXIT WHEN NOT id_exists;
  END LOOP;
  
  RETURN new_id;
END;
$$;

-- Trigger to auto-generate ape_id on profile creation
CREATE OR REPLACE FUNCTION public.set_ape_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ape_id IS NULL THEN
    NEW.ape_id := public.generate_ape_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ape_id_trigger ON public.profiles;
CREATE TRIGGER set_ape_id_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_ape_id();

-- Update existing profiles without ape_id
UPDATE public.profiles
SET ape_id = public.generate_ape_id()
WHERE ape_id IS NULL;

-- Turmas table
CREATE TABLE IF NOT EXISTS public.turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

-- Turma membros role enum
DO $$ BEGIN
  CREATE TYPE turma_role AS ENUM ('aluno', 'professor_assistente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Turma membros table
CREATE TABLE IF NOT EXISTS public.turma_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role turma_role NOT NULL DEFAULT 'aluno',
  ativo BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(turma_id, user_id)
);

ALTER TABLE public.turma_membros ENABLE ROW LEVEL SECURITY;

-- Atribuições source type enum
DO $$ BEGIN
  CREATE TYPE atribuicao_fonte_tipo AS ENUM ('lista', 'pasta', 'cardset');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Atribuições table
CREATE TABLE IF NOT EXISTS public.atribuicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  fonte_tipo atribuicao_fonte_tipo NOT NULL,
  fonte_id UUID NOT NULL,
  data_limite TIMESTAMP WITH TIME ZONE,
  pontos_vale INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.atribuicoes ENABLE ROW LEVEL SECURITY;

-- Atribuições status enum
DO $$ BEGIN
  CREATE TYPE atribuicao_status AS ENUM ('pendente', 'em_andamento', 'concluida');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Atribuições status table
CREATE TABLE IF NOT EXISTS public.atribuicoes_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atribuicao_id UUID NOT NULL REFERENCES public.atribuicoes(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status atribuicao_status NOT NULL DEFAULT 'pendente',
  progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(atribuicao_id, aluno_id)
);

ALTER TABLE public.atribuicoes_status ENABLE ROW LEVEL SECURITY;

-- Helper function: is teacher owner of turma
CREATE OR REPLACE FUNCTION public.is_turma_owner(_turma_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.turmas
    WHERE id = _turma_id AND owner_teacher_id = _user_id
  )
$$;

-- Helper function: is member of turma
CREATE OR REPLACE FUNCTION public.is_turma_member(_turma_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.turma_membros
    WHERE turma_id = _turma_id AND user_id = _user_id AND ativo = true
  )
$$;

-- RLS POLICIES: turmas
CREATE POLICY "Teachers can view their own turmas"
ON public.turmas FOR SELECT
USING (auth.uid() = owner_teacher_id);

CREATE POLICY "Members can view their turmas"
ON public.turmas FOR SELECT
USING (is_turma_member(id, auth.uid()));

CREATE POLICY "Teachers can insert their own turmas"
ON public.turmas FOR INSERT
WITH CHECK (auth.uid() = owner_teacher_id);

CREATE POLICY "Teachers can update their own turmas"
ON public.turmas FOR UPDATE
USING (auth.uid() = owner_teacher_id)
WITH CHECK (auth.uid() = owner_teacher_id);

CREATE POLICY "Teachers can delete their own turmas"
ON public.turmas FOR DELETE
USING (auth.uid() = owner_teacher_id);

-- RLS POLICIES: turma_membros
CREATE POLICY "Turma owners can manage members"
ON public.turma_membros FOR ALL
USING (is_turma_owner(turma_id, auth.uid()));

CREATE POLICY "Members can view their own membership"
ON public.turma_membros FOR SELECT
USING (auth.uid() = user_id);

-- RLS POLICIES: atribuicoes
CREATE POLICY "Turma owners can manage atribuicoes"
ON public.atribuicoes FOR ALL
USING (is_turma_owner(turma_id, auth.uid()));

CREATE POLICY "Turma members can view atribuicoes"
ON public.atribuicoes FOR SELECT
USING (is_turma_member(turma_id, auth.uid()));

-- RLS POLICIES: atribuicoes_status
CREATE POLICY "Alunos can view their own status"
ON public.atribuicoes_status FOR SELECT
USING (auth.uid() = aluno_id);

CREATE POLICY "Alunos can update their own status"
ON public.atribuicoes_status FOR UPDATE
USING (auth.uid() = aluno_id)
WITH CHECK (auth.uid() = aluno_id);

CREATE POLICY "Teachers can view all status in their turmas"
ON public.atribuicoes_status FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.atribuicoes a
    WHERE a.id = atribuicoes_status.atribuicao_id
      AND is_turma_owner(a.turma_id, auth.uid())
  )
);

CREATE POLICY "System can insert atribuicoes_status"
ON public.atribuicoes_status FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at on turmas
CREATE OR REPLACE FUNCTION public.update_turmas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_turmas_updated_at_trigger ON public.turmas;
CREATE TRIGGER update_turmas_updated_at_trigger
BEFORE UPDATE ON public.turmas
FOR EACH ROW
EXECUTE FUNCTION public.update_turmas_updated_at();

-- Trigger for updated_at on atribuicoes_status
DROP TRIGGER IF EXISTS update_atribuicoes_status_updated_at_trigger ON public.atribuicoes_status;
CREATE TRIGGER update_atribuicoes_status_updated_at_trigger
BEFORE UPDATE ON public.atribuicoes_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();