-- Adicionar constraint UNIQUE na coluna user_id da tabela user_roles
-- Isso é necessário para o trigger assign_default_role funcionar corretamente
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_key;

ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);