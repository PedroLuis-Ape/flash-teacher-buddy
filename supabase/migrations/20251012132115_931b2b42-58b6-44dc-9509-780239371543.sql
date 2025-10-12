-- Add RLS policies for folders table to allow owners to INSERT, UPDATE, DELETE

-- Policy for INSERT: Only authenticated users can create folders for themselves
CREATE POLICY "Users can create their own folders"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Policy for UPDATE: Only owners can update their own folders
CREATE POLICY "Owners can update their own folders"
ON public.folders
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Policy for DELETE: Only owners can delete their own folders
CREATE POLICY "Owners can delete their own folders"
ON public.folders
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);