-- Create folders table
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'class')),
  class_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lists table
CREATE TABLE public.lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'class')),
  class_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add list_id to flashcards and make collection_id nullable for migration
ALTER TABLE public.flashcards 
  ADD COLUMN list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE,
  ALTER COLUMN collection_id DROP NOT NULL;

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
CREATE POLICY "Owner can view own folders"
  ON public.folders FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Public can view shared folders"
  ON public.folders FOR SELECT
  USING (visibility = 'class');

CREATE POLICY "Owner can create folders"
  ON public.folders FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update own folders"
  ON public.folders FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owner can delete own folders"
  ON public.folders FOR DELETE
  USING (owner_id = auth.uid());

-- RLS Policies for lists
CREATE POLICY "Owner can view own lists"
  ON public.lists FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Public can view lists from shared folders"
  ON public.lists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.folders 
      WHERE folders.id = lists.folder_id 
      AND folders.visibility = 'class'
    )
  );

CREATE POLICY "Owner can create lists"
  ON public.lists FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update own lists"
  ON public.lists FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owner can delete own lists"
  ON public.lists FOR DELETE
  USING (owner_id = auth.uid());

-- Update flashcards RLS for list-based access
DROP POLICY IF EXISTS "Public can view flashcards from public collections" ON public.flashcards;
DROP POLICY IF EXISTS "Users can view flashcards from accessible collections" ON public.flashcards;

CREATE POLICY "Owner can view own flashcards"
  ON public.flashcards FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Public can view flashcards from shared lists"
  ON public.flashcards FOR SELECT
  USING (
    list_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.lists l
      JOIN public.folders f ON f.id = l.folder_id
      WHERE l.id = flashcards.list_id 
      AND f.visibility = 'class'
    )
  );

-- Update triggers for updated_at
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();