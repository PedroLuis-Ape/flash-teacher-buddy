-- Adicionar colunas para controle do pop-up de conexão Google
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_connect_prompt_version_seen integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS google_connect_prompt_dont_show boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS google_connected_at timestamptz;

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.google_connect_prompt_version_seen IS 'Versão do prompt de conexão Google que o usuário já viu';
COMMENT ON COLUMN public.profiles.google_connect_prompt_dont_show IS 'Se true, não mostrar mais o prompt de conexão Google';
COMMENT ON COLUMN public.profiles.google_connected_at IS 'Data/hora em que o usuário conectou sua conta Google';