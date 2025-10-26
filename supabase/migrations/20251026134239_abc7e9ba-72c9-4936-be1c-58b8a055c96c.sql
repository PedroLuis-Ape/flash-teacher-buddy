-- Create videos table
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  title text,
  url text NOT NULL,
  provider text NOT NULL DEFAULT 'youtube',
  video_id text NOT NULL,
  thumbnail_url text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_videos_folder_published ON public.videos(folder_id, is_published, order_index);
CREATE INDEX idx_videos_video_id ON public.videos(video_id);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Owner can manage their videos
CREATE POLICY "Owners can manage their videos"
ON public.videos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.folders
    WHERE folders.id = videos.folder_id
    AND folders.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.folders
    WHERE folders.id = videos.folder_id
    AND folders.owner_id = auth.uid()
  )
);

-- Students and visitors can view published videos from shared folders
CREATE POLICY "Users can view videos from shared folders"
ON public.videos
FOR SELECT
USING (
  is_published = true
  AND EXISTS (
    SELECT 1 FROM public.folders
    WHERE folders.id = videos.folder_id
    AND (
      folders.owner_id = auth.uid()
      OR folders.visibility = 'class'
      OR folders.visibility = 'public'
    )
  )
);

-- Public portal can view videos from public folders
CREATE POLICY "Public can view videos from public folders"
ON public.videos
FOR SELECT
USING (
  is_published = true
  AND EXISTS (
    SELECT 1 FROM public.folders f
    JOIN public.profiles p ON p.id = f.owner_id
    WHERE f.id = videos.folder_id
    AND f.visibility = 'class'
    AND COALESCE(p.public_access_enabled, false) = true
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();