-- Clear email from profiles to prevent PII leakage via turma member SELECT policies
-- Email is already stored in auth.users and accessible via session
UPDATE public.profiles SET email = NULL WHERE email IS NOT NULL;

-- Prevent future writes to email column by updating the handle_new_user trigger
-- to not copy email from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;