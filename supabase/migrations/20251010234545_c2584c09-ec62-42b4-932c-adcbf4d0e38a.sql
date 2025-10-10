-- Remove the old check constraint
ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_visibility_check;

-- Add new check constraint that allows 'private', 'public', and 'class'
ALTER TABLE public.collections 
ADD CONSTRAINT collections_visibility_check 
CHECK (visibility IN ('private', 'public', 'class'));