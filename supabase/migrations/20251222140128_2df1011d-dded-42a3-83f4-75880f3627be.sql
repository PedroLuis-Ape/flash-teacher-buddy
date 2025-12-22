-- Create folder_texts table for storing reading materials
CREATE TABLE public.folder_texts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT 'Texto',
    content text NOT NULL DEFAULT '',
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add index for folder lookups
CREATE INDEX idx_folder_texts_folder_id ON public.folder_texts(folder_id);

-- Enable RLS
ALTER TABLE public.folder_texts ENABLE ROW LEVEL SECURITY;

-- Policy: Folder owners can manage their texts
CREATE POLICY "Owners can manage their texts"
ON public.folder_texts
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.folders f
        WHERE f.id = folder_texts.folder_id
        AND f.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.folders f
        WHERE f.id = folder_texts.folder_id
        AND f.owner_id = auth.uid()
    )
);

-- Policy: Turma owners can manage texts in turma folders
CREATE POLICY "Turma owners can manage texts"
ON public.folder_texts
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.folders f
        WHERE f.id = folder_texts.folder_id
        AND is_turma_owner(f.class_id, auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.folders f
        WHERE f.id = folder_texts.folder_id
        AND is_turma_owner(f.class_id, auth.uid())
    )
);

-- Policy: Turma members can view texts in turma folders
CREATE POLICY "Turma members can view texts"
ON public.folder_texts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.folders f
        WHERE f.id = folder_texts.folder_id
        AND is_turma_member(f.class_id, auth.uid())
    )
);

-- Policy: Anyone can view texts from shared folders
CREATE POLICY "Anyone can view shared folder texts"
ON public.folder_texts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.folders f
        JOIN public.profiles p ON p.id = f.owner_id
        WHERE f.id = folder_texts.folder_id
        AND f.visibility = 'class'
        AND COALESCE(p.public_access_enabled, false) = true
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_folder_texts_updated_at
BEFORE UPDATE ON public.folder_texts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();