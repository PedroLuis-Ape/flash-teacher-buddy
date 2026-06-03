ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS detailed_explanation text,
  ADD COLUMN IF NOT EXISTS usage_notes text,
  ADD COLUMN IF NOT EXISTS common_mistakes text;