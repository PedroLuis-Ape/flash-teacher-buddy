-- Create public_catalog table for store items
CREATE TABLE IF NOT EXISTS public.public_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('normal', 'rare', 'epic', 'legendary')),
  price_pitecoin INTEGER NOT NULL,
  avatar_final TEXT NOT NULL,
  card_final TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.public_catalog ENABLE ROW LEVEL SECURITY;

-- Anyone can view active items
CREATE POLICY "Anyone can view active catalog items"
ON public.public_catalog
FOR SELECT
USING (is_active = true);

-- Create update trigger
CREATE TRIGGER update_public_catalog_updated_at
BEFORE UPDATE ON public.public_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();