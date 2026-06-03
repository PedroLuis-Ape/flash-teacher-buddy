CREATE TABLE public.user_special_flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  list_id uuid REFERENCES public.lists(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, flashcard_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_special_flashcards TO authenticated;
GRANT ALL ON public.user_special_flashcards TO service_role;

ALTER TABLE public.user_special_flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own special flashcards"
ON public.user_special_flashcards
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own special flashcards"
ON public.user_special_flashcards
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own special flashcards"
ON public.user_special_flashcards
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_user_special_flashcards_user ON public.user_special_flashcards(user_id);
CREATE INDEX idx_user_special_flashcards_card ON public.user_special_flashcards(flashcard_id);