
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS parent_card_id uuid NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS layer_index integer NULL,
  ADD COLUMN IF NOT EXISTS example_text text NULL,
  ADD COLUMN IF NOT EXISTS example_translation text NULL,
  ADD COLUMN IF NOT EXISTS context_tag text NULL,
  ADD COLUMN IF NOT EXISTS short_explanation text NULL;

CREATE INDEX IF NOT EXISTS idx_flashcards_parent_layer
  ON public.flashcards (parent_card_id, layer_index)
  WHERE parent_card_id IS NOT NULL;
