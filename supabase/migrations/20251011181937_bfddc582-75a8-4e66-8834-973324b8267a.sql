-- Fix 1: Implement proper role-based access control with security definer functions
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('owner', 'student');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to automatically assign student role to new users
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

-- Trigger to assign default role on user creation
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_role();

-- RLS policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Fix 2: Update RLS policies to use security definer function instead of profile role
-- Update collections policies
DROP POLICY IF EXISTS "Only owners can create collections" ON public.collections;
CREATE POLICY "Only owners can create collections"
ON public.collections
FOR INSERT
WITH CHECK (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

DROP POLICY IF EXISTS "Only owners can update their collections" ON public.collections;
CREATE POLICY "Only owners can update their collections"
ON public.collections
FOR UPDATE
USING (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

DROP POLICY IF EXISTS "Only owners can delete their collections" ON public.collections;
CREATE POLICY "Only owners can delete their collections"
ON public.collections
FOR DELETE
USING (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

-- Update folders policies
DROP POLICY IF EXISTS "Owner can create folders" ON public.folders;
CREATE POLICY "Owner can create folders"
ON public.folders
FOR INSERT
WITH CHECK (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

DROP POLICY IF EXISTS "Owner can update own folders" ON public.folders;
CREATE POLICY "Owner can update own folders"
ON public.folders
FOR UPDATE
USING (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

DROP POLICY IF EXISTS "Owner can delete own folders" ON public.folders;
CREATE POLICY "Owner can delete own folders"
ON public.folders
FOR DELETE
USING (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

-- Update lists policies
DROP POLICY IF EXISTS "Owner can create lists" ON public.lists;
CREATE POLICY "Owner can create lists"
ON public.lists
FOR INSERT
WITH CHECK (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

DROP POLICY IF EXISTS "Owner can update own lists" ON public.lists;
CREATE POLICY "Owner can update own lists"
ON public.lists
FOR UPDATE
USING (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

DROP POLICY IF EXISTS "Owner can delete own lists" ON public.lists;
CREATE POLICY "Owner can delete own lists"
ON public.lists
FOR DELETE
USING (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

-- Update classes policies
DROP POLICY IF EXISTS "Only owners can create classes" ON public.classes;
CREATE POLICY "Only owners can create classes"
ON public.classes
FOR INSERT
WITH CHECK (
  owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
);

-- Fix 3: Require authentication for shared content (keep public_access_enabled flag for controlled public access)
-- Update folders SELECT policy to require auth OR public_access_enabled
DROP POLICY IF EXISTS "Anyone can view shared folders" ON public.folders;
CREATE POLICY "Authenticated users or public portal can view shared folders"
ON public.folders
FOR SELECT
USING (
  (visibility = 'class' AND auth.uid() IS NOT NULL)
  OR
  (visibility = 'class' AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = folders.owner_id 
    AND profiles.public_access_enabled = true
  ))
);

-- Update lists SELECT policy
DROP POLICY IF EXISTS "Anyone can view lists from shared folders" ON public.lists;
CREATE POLICY "Authenticated users or public portal can view lists from shared folders"
ON public.lists
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM folders
    WHERE folders.id = lists.folder_id
    AND (
      (folders.visibility = 'class' AND auth.uid() IS NOT NULL)
      OR
      (folders.visibility = 'class' AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = folders.owner_id 
        AND profiles.public_access_enabled = true
      ))
    )
  )
);

-- Update flashcards SELECT policy for shared lists
DROP POLICY IF EXISTS "Anyone can view flashcards from shared lists" ON public.flashcards;
CREATE POLICY "Authenticated users or public portal can view flashcards from shared lists"
ON public.flashcards
FOR SELECT
USING (
  (list_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1
      FROM lists l
      JOIN folders f ON f.id = l.folder_id
      WHERE l.id = flashcards.list_id
      AND (
        (f.visibility = 'class' AND auth.uid() IS NOT NULL)
        OR
        (f.visibility = 'class' AND EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = f.owner_id 
          AND profiles.public_access_enabled = true
        ))
      )
    )
  )
);

-- Update collections public access policy
DROP POLICY IF EXISTS "Public can view collections from teachers with public access" ON public.collections;
CREATE POLICY "Authenticated or public portal can view collections"
ON public.collections
FOR SELECT
USING (
  (visibility = 'public' AND auth.uid() IS NOT NULL)
  OR
  (visibility = 'public' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = collections.owner_id
    AND profiles.public_access_enabled = true
  ))
  OR
  ((visibility = 'class') AND (class_id IS NOT NULL) AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = collections.owner_id
    AND profiles.public_access_enabled = true
  ))
);

-- Update flashcards SELECT policy for collections
DROP POLICY IF EXISTS "Anyone can view flashcards from collections" ON public.flashcards;
CREATE POLICY "Authenticated or public portal can view flashcards from collections"
ON public.flashcards
FOR SELECT
USING (
  (collection_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1
      FROM collections
      WHERE collections.id = flashcards.collection_id
      AND (
        (collections.visibility = 'public' AND auth.uid() IS NOT NULL)
        OR
        (collections.visibility = 'public' AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = collections.owner_id
          AND profiles.public_access_enabled = true
        ))
        OR
        ((collections.visibility = 'class') AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = collections.owner_id
          AND profiles.public_access_enabled = true
        ))
      )
    )
  )
);