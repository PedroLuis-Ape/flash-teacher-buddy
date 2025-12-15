-- Add multi-language support fields to lists table
-- study_type: 'language' (default for existing) or 'general' (no TTS)
-- lang_a/lang_b: language codes for the two sides (only for language mode)
-- labels_a/labels_b: custom labels for the two sides
-- tts_enabled: whether TTS is enabled for this list

-- Add new columns with safe defaults
ALTER TABLE public.lists 
ADD COLUMN IF NOT EXISTS study_type text NOT NULL DEFAULT 'language',
ADD COLUMN IF NOT EXISTS lang_a text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS lang_b text DEFAULT 'pt',
ADD COLUMN IF NOT EXISTS labels_a text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS labels_b text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tts_enabled boolean NOT NULL DEFAULT true;

-- Add check constraint for study_type
ALTER TABLE public.lists 
ADD CONSTRAINT lists_study_type_check 
CHECK (study_type IN ('language', 'general'));

-- Add comment for documentation
COMMENT ON COLUMN public.lists.study_type IS 'Type of study: language (with TTS) or general (no TTS)';
COMMENT ON COLUMN public.lists.lang_a IS 'Language code for side A (e.g., en, pt, fr, es)';
COMMENT ON COLUMN public.lists.lang_b IS 'Language code for side B (e.g., en, pt, fr, es)';
COMMENT ON COLUMN public.lists.labels_a IS 'Custom label for side A (default: language name or "Frente")';
COMMENT ON COLUMN public.lists.labels_b IS 'Custom label for side B (default: language name or "Verso")';
COMMENT ON COLUMN public.lists.tts_enabled IS 'Whether TTS is enabled for this list';