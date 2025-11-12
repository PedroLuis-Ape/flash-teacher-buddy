-- Rollback: Aplicar RLS deny all nas tabelas do sistema de classes
-- Isso mantém as tabelas mas impede acesso até o feature flag ser reativado

-- Tabela notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Deny all access to notifications" ON public.notifications FOR ALL USING (false);

-- Tabela classes
DROP POLICY IF EXISTS "Class owners can view their classes" ON public.classes;
DROP POLICY IF EXISTS "Class members can view their classes" ON public.classes;
DROP POLICY IF EXISTS "Class owners can update their classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can create classes" ON public.classes;
CREATE POLICY "Deny all access to classes" ON public.classes FOR ALL USING (false);

-- Tabela class_members
DROP POLICY IF EXISTS "Class owners can view members" ON public.class_members;
DROP POLICY IF EXISTS "Members can view their own membership" ON public.class_members;
DROP POLICY IF EXISTS "Class owners can manage members" ON public.class_members;
DROP POLICY IF EXISTS "Students can join classes" ON public.class_members;
CREATE POLICY "Deny all access to class_members" ON public.class_members FOR ALL USING (false);

-- Tabela announcements
DROP POLICY IF EXISTS "Class members can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Class owners can create announcements" ON public.announcements;
DROP POLICY IF EXISTS "Class owners can update their announcements" ON public.announcements;
DROP POLICY IF EXISTS "Class owners can delete their announcements" ON public.announcements;
CREATE POLICY "Deny all access to announcements" ON public.announcements FOR ALL USING (false);

-- Tabela threads
DROP POLICY IF EXISTS "Thread participants can view" ON public.threads;
DROP POLICY IF EXISTS "Users can create threads" ON public.threads;
CREATE POLICY "Deny all access to threads" ON public.threads FOR ALL USING (false);

-- Tabela messages
DROP POLICY IF EXISTS "Thread participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Thread participants can send messages" ON public.messages;
CREATE POLICY "Deny all access to messages" ON public.messages FOR ALL USING (false);