-- Criar função para atualizar role do usuário
CREATE OR REPLACE FUNCTION public.update_user_role(p_user_id uuid, p_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_roles
  SET role = p_role
  WHERE user_id = p_user_id;
END;
$$;