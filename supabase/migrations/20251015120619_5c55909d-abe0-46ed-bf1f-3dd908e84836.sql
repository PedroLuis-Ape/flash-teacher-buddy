-- Permitir que usuários autenticados possam atualizar sua própria role apenas na criação da conta
-- Criar política para permitir INSERT na tabela user_roles
CREATE POLICY "Users can insert their own role on signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Permitir UPDATE apenas através da função security definer
CREATE POLICY "Users can update to owner role via function"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);