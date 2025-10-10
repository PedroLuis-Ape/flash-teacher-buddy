-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view classes they own or are members of" ON public.classes;
DROP POLICY IF EXISTS "Users can view class members if they are members" ON public.class_members;
DROP POLICY IF EXISTS "Users can view own collections or class collections" ON public.collections;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.is_class_member(_class_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_members
    WHERE class_id = _class_id
      AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_class_owner(_class_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes
    WHERE id = _class_id
      AND owner_id = _user_id
  )
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Users can view classes they own or are members of" 
  ON public.classes FOR SELECT 
  USING (
    owner_id = auth.uid() OR 
    public.is_class_member(id, auth.uid())
  );

CREATE POLICY "Users can view class members if they are members" 
  ON public.class_members FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    public.is_class_owner(class_id, auth.uid())
  );

CREATE POLICY "Users can view own collections or class collections" 
  ON public.collections FOR SELECT 
  USING (
    owner_id = auth.uid() OR 
    (visibility = 'class' AND class_id IS NOT NULL AND 
     public.is_class_member(class_id, auth.uid()))
  );