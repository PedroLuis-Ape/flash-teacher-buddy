
-- List glossary: global word hints per list
CREATE TABLE public.list_glossary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  note TEXT,
  side TEXT NOT NULL DEFAULT 'A',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_list_glossary_list_id ON public.list_glossary(list_id);

ALTER TABLE public.list_glossary ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "glossary_owner_all" ON public.list_glossary
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_glossary.list_id AND l.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_glossary.list_id AND l.owner_id = auth.uid())
  );

-- Turma members read access
CREATE POLICY "glossary_turma_read" ON public.list_glossary
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lists l
      JOIN public.turma_membros tm ON tm.turma_id = l.class_id
      WHERE l.id = list_glossary.list_id AND tm.user_id = auth.uid()
    )
  );
