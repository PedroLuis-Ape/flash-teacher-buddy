
-- Fix 1: Remove unrestricted INSERT on user_inventory (bypass purchase flow)
DROP POLICY IF EXISTS "Users can add to their own inventory" ON public.user_inventory;

-- Fix 2: Remove email column from profiles (PII exposure to turma members)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Fix 3: Remove unrestricted INSERT on notifications (any user can notify any other)
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
