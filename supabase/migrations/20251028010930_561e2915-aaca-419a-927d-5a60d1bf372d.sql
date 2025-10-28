-- Create skins catalog table
CREATE TABLE public.skins_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('normal', 'rare', 'epic', 'legendary')),
  price_pitecoin INTEGER NOT NULL DEFAULT 0,
  avatar_img TEXT NOT NULL,
  card_img TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user inventory table
CREATE TABLE public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skin_id TEXT NOT NULL REFERENCES public.skins_catalog(id),
  acquired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, skin_id)
);

-- Add equipped skin fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_skin_id TEXT REFERENCES public.skins_catalog(id),
ADD COLUMN IF NOT EXISTS mascot_skin_id TEXT REFERENCES public.skins_catalog(id);

-- Enable RLS
ALTER TABLE public.skins_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for skins_catalog (everyone can view active skins)
CREATE POLICY "Anyone can view active skins"
  ON public.skins_catalog
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for user_inventory
CREATE POLICY "Users can view their own inventory"
  ON public.user_inventory
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own inventory"
  ON public.user_inventory
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Insert starter skin (Piteco Prime - free)
INSERT INTO public.skins_catalog (id, name, rarity, price_pitecoin, avatar_img, card_img, description)
VALUES 
  ('piteco-prime', 'PITECO Prime', 'normal', 0, '/placeholder.svg', '/placeholder.svg', 'O clássico PITECO. Sempre disponível para todos!'),
  ('piteco-astronaut', 'PITECO Astronauta', 'epic', 50, '/placeholder.svg', '/placeholder.svg', 'Explore o universo com estilo! Edição limitada.'),
  ('piteco-scientist', 'PITECO Cientista', 'rare', 25, '/placeholder.svg', '/placeholder.svg', 'Para os estudiosos! Vem com jaleco e tudo.'),
  ('piteco-gold', 'PITECO Dourado', 'legendary', 100, '/placeholder.svg', '/placeholder.svg', 'A lenda! Brilho supremo e exclusividade máxima.')
ON CONFLICT (id) DO NOTHING;

-- Create index for faster queries
CREATE INDEX idx_user_inventory_user_id ON public.user_inventory(user_id);
CREATE INDEX idx_user_inventory_skin_id ON public.user_inventory(skin_id);