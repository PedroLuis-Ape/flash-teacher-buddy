-- Generic per-user attention markers for folders and lists.
-- The frontend includes a device fallback, so the UI remains functional while
-- this migration is being applied or while PostgREST refreshes its schema cache.

CREATE TABLE IF NOT EXISTS public.user_resource_attention (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('folder', 'list')),
  resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_type, resource_id)
);

ALTER TABLE public.user_resource_attention ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own resource attention markers"
  ON public.user_resource_attention;
CREATE POLICY "Users can view their own resource attention markers"
  ON public.user_resource_attention
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add their own resource attention markers"
  ON public.user_resource_attention;
CREATE POLICY "Users can add their own resource attention markers"
  ON public.user_resource_attention
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their own resource attention markers"
  ON public.user_resource_attention;
CREATE POLICY "Users can remove their own resource attention markers"
  ON public.user_resource_attention
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_resource_attention_user_type_created
  ON public.user_resource_attention (user_id, resource_type, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.user_resource_attention TO authenticated;
GRANT ALL ON public.user_resource_attention TO service_role;

DO $$
BEGIN
  IF to_regclass('public.user_list_attention') IS NOT NULL THEN
    INSERT INTO public.user_resource_attention (user_id, resource_type, resource_id, created_at)
    SELECT user_id, 'list', list_id, created_at
    FROM public.user_list_attention
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
