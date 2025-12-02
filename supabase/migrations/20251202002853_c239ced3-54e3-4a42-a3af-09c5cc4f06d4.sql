-- Create institutions (hubs) table
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Users can view their own institutions
CREATE POLICY "Users can view their own institutions"
ON public.institutions
FOR SELECT
USING (auth.uid() = owner_id);

-- Users can create their own institutions
CREATE POLICY "Users can create their own institutions"
ON public.institutions
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Users can update their own institutions
CREATE POLICY "Users can update their own institutions"
ON public.institutions
FOR UPDATE
USING (auth.uid() = owner_id);

-- Users can delete their own institutions
CREATE POLICY "Users can delete their own institutions"
ON public.institutions
FOR DELETE
USING (auth.uid() = owner_id);

-- Add institution_id to existing tables
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_institutions_owner ON public.institutions(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_institution ON public.folders(institution_id);
CREATE INDEX IF NOT EXISTS idx_lists_institution ON public.lists(institution_id);
CREATE INDEX IF NOT EXISTS idx_turmas_institution ON public.turmas(institution_id);

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_institutions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_institutions_updated_at
BEFORE UPDATE ON public.institutions
FOR EACH ROW
EXECUTE FUNCTION public.update_institutions_updated_at();