-- Add public_slug to profiles for student access
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS public_slug text UNIQUE,
ADD COLUMN IF NOT EXISTS public_access_enabled boolean DEFAULT false;

-- Create index for faster public slug lookups
CREATE INDEX IF NOT EXISTS idx_profiles_public_slug ON public.profiles(public_slug) WHERE public_slug IS NOT NULL;

-- Update collections table to support public visibility via teacher's public link
-- The visibility field already exists, we'll use it

-- Add RLS policy for public read access to collections
CREATE POLICY "Public can view collections from teachers with public access" 
ON public.collections 
FOR SELECT 
USING (
  visibility = 'public' 
  OR (
    visibility = 'class' 
    AND EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE profiles.id = collections.owner_id 
        AND profiles.public_access_enabled = true
    )
  )
);

-- Add RLS policy for public read access to flashcards
CREATE POLICY "Public can view flashcards from public collections" 
ON public.flashcards 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.collections c
    LEFT JOIN public.profiles p ON p.id = c.owner_id
    WHERE c.id = flashcards.collection_id 
      AND (
        c.visibility = 'public' 
        OR (c.visibility = 'class' AND p.public_access_enabled = true)
      )
  )
);