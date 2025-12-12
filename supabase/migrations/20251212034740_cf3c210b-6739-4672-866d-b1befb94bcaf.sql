-- Add last_active_at field to profiles for online status tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT NULL;

-- Create index for efficient queries on last_active_at
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON public.profiles(last_active_at);

-- Update RLS: Allow users to update their own last_active_at
-- (profiles already has policies for users to update their own profile)