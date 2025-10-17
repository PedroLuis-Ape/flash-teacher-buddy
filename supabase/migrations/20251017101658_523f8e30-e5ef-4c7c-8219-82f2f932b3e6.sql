-- 1) Permitir que usuários autenticados busquem perfis de professores públicos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Authenticated can view public teacher profiles'
  ) THEN
    CREATE POLICY "Authenticated can view public teacher profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public_access_enabled = true);
  END IF;
END$$;

-- 2) Gatilhos após signup para criar profile e atribuir role padrão
DO $$
BEGIN
  -- Trigger para criar/atualizar profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;

  -- Trigger para atribuir role padrão (student/owner) baseado em profiles.public_access_enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_role'
  ) THEN
    CREATE TRIGGER on_auth_user_created_role
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.assign_default_role();
  END IF;
END$$;

-- 3) Restringir user_roles a um registro por usuário e fazer backfill
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_unique'
  ) THEN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END$$;

-- Backfill dos roles existentes com base em profiles.public_access_enabled
INSERT INTO public.user_roles (user_id, role)
SELECT p.id,
       CASE WHEN COALESCE(p.public_access_enabled, false) THEN 'owner'::app_role ELSE 'student'::app_role END
FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role;
