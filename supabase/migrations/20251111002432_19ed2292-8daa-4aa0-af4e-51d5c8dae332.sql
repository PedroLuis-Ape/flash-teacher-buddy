-- Criar função de verificação de role (security definer para evitar recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Políticas RLS para admin ter controle total sobre skins_catalog

-- Permitir admin inserir novas skins
CREATE POLICY "Admin can insert skins"
ON public.skins_catalog
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'developer_admin'::public.app_role)
);

-- Permitir admin atualizar skins
CREATE POLICY "Admin can update skins"
ON public.skins_catalog
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'developer_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'developer_admin'::public.app_role)
);

-- Permitir admin deletar skins
CREATE POLICY "Admin can delete skins"
ON public.skins_catalog
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'developer_admin'::public.app_role)
);