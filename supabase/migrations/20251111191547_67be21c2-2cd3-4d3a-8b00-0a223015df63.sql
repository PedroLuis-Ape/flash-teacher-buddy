-- MVP 2: Mural, Comentários em Tarefas e Notificações
-- Extensão do MVP 1 sem breaking changes

-- 1. Criar tabela de anúncios (Mural da Turma)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (LENGTH(TRIM(title)) BETWEEN 1 AND 200),
  body TEXT NOT NULL CHECK (LENGTH(TRIM(body)) BETWEEN 1 AND 5000),
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_class_id ON public.announcements(class_id);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON public.announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON public.announcements(pinned, created_at DESC) WHERE archived_at IS NULL;

-- 2. Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('dm', 'announcement', 'comment')),
  ref_type TEXT NOT NULL CHECK (ref_type IN ('thread', 'announcement', 'assignment')),
  ref_id UUID NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_ref ON public.notifications(ref_type, ref_id);

-- 3. Estender tabela threads (adicionar colunas opcionais sem quebrar MVP 1)
ALTER TABLE public.threads 
  ADD COLUMN IF NOT EXISTS announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assignment_id UUID,
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Criar índices para as novas colunas
CREATE INDEX IF NOT EXISTS idx_threads_announcement ON public.threads(announcement_id) WHERE announcement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threads_assignment ON public.threads(assignment_id, student_id) WHERE assignment_id IS NOT NULL;

-- 4. Adicionar constraint para garantir idempotência em threads de anúncios
CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_unique_announcement 
  ON public.threads(announcement_id) 
  WHERE type = 'announcement' AND announcement_id IS NOT NULL;

-- 5. Adicionar constraint para garantir idempotência em threads de tarefas
CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_unique_assignment 
  ON public.threads(assignment_id, student_id) 
  WHERE type = 'assignment' AND assignment_id IS NOT NULL AND student_id IS NOT NULL;

-- 6. RLS Policies para announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Apenas professor (owner da turma) pode criar anúncios
CREATE POLICY "Class owners can create announcements"
  ON public.announcements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = announcements.class_id
        AND owner_id = auth.uid()
    )
  );

-- Apenas professor pode editar/arquivar seus próprios anúncios
CREATE POLICY "Class owners can update their announcements"
  ON public.announcements
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = announcements.class_id
        AND owner_id = auth.uid()
    )
  );

-- Membros da turma podem ver anúncios não arquivados
CREATE POLICY "Class members can view announcements"
  ON public.announcements
  FOR SELECT
  USING (
    archived_at IS NULL AND (
      is_class_owner(class_id, auth.uid()) OR
      is_class_member(class_id, auth.uid())
    )
  );

-- Apenas professor pode deletar anúncios
CREATE POLICY "Class owners can delete announcements"
  ON public.announcements
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = announcements.class_id
        AND owner_id = auth.uid()
    )
  );

-- 7. RLS Policies para notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Sistema pode criar notificações para qualquer usuário
CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Usuários podem ver apenas suas próprias notificações
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuários podem marcar suas próprias notificações como lidas
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. Atualizar RLS de threads para suportar announcement e assignment
-- Permitir criação de threads de anúncios (membros da turma)
DROP POLICY IF EXISTS "Active class members can create threads" ON public.threads;

CREATE POLICY "Class members can create threads"
  ON public.threads
  FOR INSERT
  WITH CHECK (
    (user_a_id = auth.uid() OR user_b_id = auth.uid()) AND
    (
      -- DM: precisa ser membro da turma
      (type = 'dm' AND EXISTS (
        SELECT 1 FROM class_members
        WHERE class_id = threads.class_id
          AND user_id = auth.uid()
          AND status = 'active'
      ))
      OR
      -- Announcement: precisa ser membro da turma
      (type = 'announcement' AND announcement_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM announcements a
        JOIN class_members cm ON cm.class_id = a.class_id
        WHERE a.id = threads.announcement_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'active'
      ))
      OR
      -- Assignment: apenas professor ou aluno dono da tarefa
      (type = 'assignment' AND assignment_id IS NOT NULL AND student_id IS NOT NULL AND (
        auth.uid() = student_id OR
        EXISTS (
          SELECT 1 FROM classes
          WHERE id = threads.class_id
            AND owner_id = auth.uid()
        )
      ))
    )
  );

-- 9. Atualizar RLS de threads para visualização
DROP POLICY IF EXISTS "Thread participants can view threads" ON public.threads;

CREATE POLICY "Thread participants can view threads"
  ON public.threads
  FOR SELECT
  USING (
    user_a_id = auth.uid() OR 
    user_b_id = auth.uid() OR
    -- Membros da turma podem ver threads de anúncios
    (type = 'announcement' AND EXISTS (
      SELECT 1 FROM announcements a
      JOIN class_members cm ON cm.class_id = a.class_id
      WHERE a.id = threads.announcement_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    ))
  );

-- 10. Trigger para atualizar updated_at em announcements
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_announcements_updated_at_trigger ON public.announcements;

CREATE TRIGGER update_announcements_updated_at_trigger
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();