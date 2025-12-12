-- 1) Rename old table (backup)
ALTER TABLE public.user_favorites RENAME TO user_favorites_old;

-- 2) Create new generic favorites table
CREATE TABLE public.user_favorites (
  user_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('flashcard', 'list', 'folder')),
  resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_type, resource_id)
);

-- 3) Migrate old favorites (flashcards only)
INSERT INTO public.user_favorites (user_id, resource_type, resource_id, created_at)
SELECT user_id, 'flashcard', flashcard_id, COALESCE(created_at, now())
FROM public.user_favorites_old
WHERE flashcard_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4) Enable RLS
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- 5) RLS Policies
CREATE POLICY "Users can view their own favorites"
ON public.user_favorites
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
ON public.user_favorites
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
ON public.user_favorites
FOR DELETE
USING (auth.uid() = user_id);

-- 6) Index for fast lookups
CREATE INDEX idx_user_favorites_user_type ON public.user_favorites (user_id, resource_type);