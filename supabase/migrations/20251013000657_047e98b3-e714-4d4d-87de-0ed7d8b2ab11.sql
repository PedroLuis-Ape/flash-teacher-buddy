-- Adicionar constraint de unicidade ao public_slug para evitar erros durante cadastro
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_public_slug_unique UNIQUE (public_slug);

-- Criar índice para melhorar performance nas buscas por public_slug
CREATE INDEX IF NOT EXISTS idx_profiles_public_slug ON public.profiles(public_slug) WHERE public_slug IS NOT NULL;