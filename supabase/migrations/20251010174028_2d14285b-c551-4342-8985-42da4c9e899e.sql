-- Add accepted answers columns for synonyms/alternative answers
ALTER TABLE public.flashcards 
ADD COLUMN IF NOT EXISTS accepted_answers_en TEXT[],
ADD COLUMN IF NOT EXISTS accepted_answers_pt TEXT[];