-- A) STORE CURATION: Add approval and slug fields to public_catalog (fixed for duplicates)

-- Add columns if they don't exist
ALTER TABLE public.public_catalog
ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add fields to flashcards table for language and annotations
ALTER TABLE public.flashcards
ADD COLUMN IF NOT EXISTS lang TEXT,
ADD COLUMN IF NOT EXISTS display_text TEXT,
ADD COLUMN IF NOT EXISTS eval_text TEXT,
ADD COLUMN IF NOT EXISTS note_text TEXT[];

-- Add fields to lists table for deck-level language
ALTER TABLE public.lists
ADD COLUMN IF NOT EXISTS lang TEXT;

-- Create quarantine_logs table for tracking removed items
CREATE TABLE IF NOT EXISTS public.quarantine_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  original_path TEXT NOT NULL,
  moved_to TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on quarantine_logs
ALTER TABLE public.quarantine_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Developer admins can view quarantine logs (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'quarantine_logs' 
    AND policyname = 'Developer admins can view quarantine logs'
  ) THEN
    CREATE POLICY "Developer admins can view quarantine logs"
    ON public.quarantine_logs
    FOR SELECT
    USING (is_developer_admin(auth.uid()));
  END IF;
END $$;

-- Policy: System can insert quarantine logs (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'quarantine_logs' 
    AND policyname = 'System can insert quarantine logs'
  ) THEN
    CREATE POLICY "System can insert quarantine logs"
    ON public.quarantine_logs
    FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;

-- Handle existing data: Update rows with NULL slug, handling duplicates with row number
WITH ranked_items AS (
  SELECT 
    id,
    CASE
      WHEN LOWER(name) LIKE '%vampiro%' THEN 'piteco_vampiro'
      WHEN LOWER(name) LIKE '%prime%' THEN 'piteco_prime'
      WHEN LOWER(name) LIKE '%astronaut%' THEN 'piteco_astronaut'
      WHEN LOWER(name) LIKE '%gold%' THEN 'piteco_gold'
      WHEN LOWER(name) LIKE '%scientist%' THEN 'piteco_scientist'
      ELSE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '_', 'g'))
    END as base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY CASE
        WHEN LOWER(name) LIKE '%vampiro%' THEN 'piteco_vampiro'
        WHEN LOWER(name) LIKE '%prime%' THEN 'piteco_prime'
        WHEN LOWER(name) LIKE '%astronaut%' THEN 'piteco_astronaut'
        WHEN LOWER(name) LIKE '%gold%' THEN 'piteco_gold'
        WHEN LOWER(name) LIKE '%scientist%' THEN 'piteco_scientist'
        ELSE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '_', 'g'))
      END
      ORDER BY created_at DESC
    ) as rn
  FROM public.public_catalog
  WHERE slug IS NULL
)
UPDATE public.public_catalog pc
SET 
  approved = (ri.rn = 1), -- Only the first (most recent) item is approved
  approved_by = CASE WHEN ri.rn = 1 THEN 'pedro' ELSE NULL END,
  slug = CASE 
    WHEN ri.rn = 1 THEN ri.base_slug
    ELSE ri.base_slug || '_dup_' || ri.rn
  END
FROM ranked_items ri
WHERE pc.id = ri.id;

-- Create unique index on slug (now safe from duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_catalog_slug 
ON public.public_catalog(slug) 
WHERE slug IS NOT NULL;