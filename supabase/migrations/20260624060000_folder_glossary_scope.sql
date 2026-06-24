BEGIN;

CREATE TABLE IF NOT EXISTS public.folder_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  class_id uuid NULL,
  original_text text NOT NULL CHECK (btrim(original_text) <> ''),
  translated_text text NOT NULL CHECK (btrim(translated_text) <> ''),
  original_text_normalized text GENERATED ALWAYS AS (lower(btrim(original_text))) STORED,
  translated_text_normalized text GENERATED ALWAYS AS (lower(btrim(translated_text))) STORED,
  note text,
  side text NOT NULL DEFAULT 'A' CHECK (side IN ('A', 'B')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_folder_glossary_folder_side_term_translation
ON public.folder_glossary (folder_id, side, original_text_normalized, translated_text_normalized);

CREATE INDEX IF NOT EXISTS idx_folder_glossary_folder_active
ON public.folder_glossary(folder_id, is_active, side, original_text_normalized);

COMMIT;
