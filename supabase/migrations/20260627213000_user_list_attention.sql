-- Per-user attention marker for study lists.
-- This is intentionally separate from public.lists so one user's difficulty
-- marker never changes the list for teachers, students or other accounts.

CREATE TABLE IF NOT EXISTS public.user_list_attention (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, list_id)
);

ALTER TABLE public.user_list_attention ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own list attention markers"
  ON public.user_list_attention;
CREATE POLICY "Users can view their own list attention markers"
  ON public.user_list_attention
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add their own list attention markers"
  ON public.user_list_attention;
CREATE POLICY "Users can add their own list attention markers"
  ON public.user_list_attention
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their own list attention markers"
  ON public.user_list_attention;
CREATE POLICY "Users can remove their own list attention markers"
  ON public.user_list_attention
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_list_attention_user_created
  ON public.user_list_attention (user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.user_list_attention TO authenticated;
GRANT ALL ON public.user_list_attention TO service_role;
