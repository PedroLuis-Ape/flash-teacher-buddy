-- Add language/study settings columns to folders table
-- These will be inherited by lists created in the folder

ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS study_type text NOT NULL DEFAULT 'language',
ADD COLUMN IF NOT EXISTS lang_a text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS lang_b text DEFAULT 'pt',
ADD COLUMN IF NOT EXISTS labels_a text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS labels_b text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tts_enabled boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.folders.study_type IS 'Study type: language or general';
COMMENT ON COLUMN public.folders.lang_a IS 'Default language A for new lists';
COMMENT ON COLUMN public.folders.lang_b IS 'Default language B for new lists';
COMMENT ON COLUMN public.folders.labels_a IS 'Label for side A (optional override)';
COMMENT ON COLUMN public.folders.labels_b IS 'Label for side B (optional override)';
COMMENT ON COLUMN public.folders.tts_enabled IS 'TTS enabled by default for new lists';