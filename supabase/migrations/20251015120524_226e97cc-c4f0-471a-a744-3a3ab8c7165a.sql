-- Remover a função desnecessária
DROP FUNCTION IF EXISTS public.update_user_role(uuid, app_role);

-- Atualizar o trigger assign_default_role para considerar o public_access_enabled do profile
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_access_enabled boolean;
BEGIN
  -- Esperar um pouco para garantir que o perfil foi criado
  PERFORM pg_sleep(0.1);
  
  -- Verificar se o usuário tem public_access_enabled (indica professor)
  SELECT public_access_enabled INTO profile_access_enabled
  FROM public.profiles
  WHERE id = NEW.id;
  
  -- Inserir role baseado no public_access_enabled
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    CASE WHEN COALESCE(profile_access_enabled, false) = true THEN 'owner'::app_role ELSE 'student'::app_role END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = CASE WHEN COALESCE(profile_access_enabled, false) = true THEN 'owner'::app_role ELSE 'student'::app_role END;
  
  RETURN NEW;
END;
$$;