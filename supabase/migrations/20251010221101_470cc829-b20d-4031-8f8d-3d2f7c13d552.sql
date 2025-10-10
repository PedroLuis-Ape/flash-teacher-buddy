-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('owner', 'student')),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles(email);

-- Create trigger function for profile auto-creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Migrate existing users to profiles
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Create class_members table
CREATE TABLE IF NOT EXISTS public.class_members (
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'student')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (class_id, user_id)
);

ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

-- Extend collections table
ALTER TABLE public.collections 
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'class')),
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id);

-- Migrate existing collections to use owner_id (only for users that exist in profiles)
UPDATE public.collections SET owner_id = user_id 
WHERE owner_id IS NULL AND user_id IN (SELECT id FROM public.profiles);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- RLS Policies for classes
CREATE POLICY "Users can view classes they own or are members of" 
  ON public.classes FOR SELECT 
  USING (
    owner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.class_members WHERE class_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Only owners can create classes" 
  ON public.classes FOR INSERT 
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Only owners can update their classes" 
  ON public.classes FOR UPDATE 
  USING (owner_id = auth.uid());

CREATE POLICY "Only owners can delete their classes" 
  ON public.classes FOR DELETE 
  USING (owner_id = auth.uid());

-- RLS Policies for class_members
CREATE POLICY "Users can view class members if they are members" 
  ON public.class_members FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND owner_id = auth.uid())
  );

CREATE POLICY "Class owners can add members" 
  ON public.class_members FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND owner_id = auth.uid())
  );

CREATE POLICY "Users can remove themselves from classes" 
  ON public.class_members FOR DELETE 
  USING (user_id = auth.uid());

-- Update RLS Policies for collections
DROP POLICY IF EXISTS "Users can view their own collections" ON public.collections;
DROP POLICY IF EXISTS "Users can create their own collections" ON public.collections;
DROP POLICY IF EXISTS "Users can update their own collections" ON public.collections;
DROP POLICY IF EXISTS "Users can delete their own collections" ON public.collections;

CREATE POLICY "Users can view own collections or class collections" 
  ON public.collections FOR SELECT 
  USING (
    owner_id = auth.uid() OR 
    (visibility = 'class' AND class_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.class_members WHERE class_id = collections.class_id AND user_id = auth.uid()))
  );

CREATE POLICY "Only owners can create collections" 
  ON public.collections FOR INSERT 
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Only owners can update their collections" 
  ON public.collections FOR UPDATE 
  USING (owner_id = auth.uid());

CREATE POLICY "Only owners can delete their collections" 
  ON public.collections FOR DELETE 
  USING (owner_id = auth.uid());

-- Update RLS Policies for flashcards
DROP POLICY IF EXISTS "Users can view their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can create their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON public.flashcards;

CREATE POLICY "Users can view flashcards from accessible collections" 
  ON public.flashcards FOR SELECT 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.collections c 
      WHERE c.id = flashcards.collection_id 
      AND (c.owner_id = auth.uid() OR 
           (c.visibility = 'class' AND c.class_id IS NOT NULL AND 
            EXISTS (SELECT 1 FROM public.class_members WHERE class_id = c.class_id AND user_id = auth.uid())))
    )
  );

CREATE POLICY "Only collection owners can create flashcards" 
  ON public.flashcards FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.collections WHERE id = flashcards.collection_id AND owner_id = auth.uid())
  );

CREATE POLICY "Only collection owners can update flashcards" 
  ON public.flashcards FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM public.collections WHERE id = flashcards.collection_id AND owner_id = auth.uid())
  );

CREATE POLICY "Only collection owners can delete flashcards" 
  ON public.flashcards FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM public.collections WHERE id = flashcards.collection_id AND owner_id = auth.uid())
  );