-- Add role column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN role public.app_role NOT NULL DEFAULT 'student';

-- Update the assign_default_role trigger function to include the role
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;