
-- Red List table: priority-repetition layer on top of favorites
CREATE TABLE public.user_red_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, flashcard_id)
);

-- Enable RLS
ALTER TABLE public.user_red_list ENABLE ROW LEVEL SECURITY;

-- Users can view their own red list
CREATE POLICY "Users can view own red list"
  ON public.user_red_list FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can add to their own red list
CREATE POLICY "Users can add to own red list"
  ON public.user_red_list FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can remove from their own red list
CREATE POLICY "Users can remove from own red list"
  ON public.user_red_list FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
