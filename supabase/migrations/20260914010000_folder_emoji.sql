-- Optional per-folder emoji; the client keeps a local fallback until this is applied.
ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS emoji text;
