-- Add avatar_url column to profiles for profile photo
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;