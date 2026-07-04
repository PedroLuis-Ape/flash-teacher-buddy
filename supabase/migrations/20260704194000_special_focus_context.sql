-- Cards Especiais: foco pedagógico para exportações de explicação com IA.
-- Mantém compatibilidade com a fila atual e apenas adiciona metadados opcionais.

ALTER TABLE public.user_special_flashcards
  ADD COLUMN IF NOT EXISTS focus_text text,
  ADD COLUMN IF NOT EXISTS focus_side text,
  ADD COLUMN IF NOT EXISTS focus_tag text,
  ADD COLUMN IF NOT EXISTS focus_note text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_special_flashcards
  DROP CONSTRAINT IF EXISTS user_special_flashcards_focus_side_check;

ALTER TABLE public.user_special_flashcards
  ADD CONSTRAINT user_special_flashcards_focus_side_check
  CHECK (focus_side IS NULL OR focus_side IN ('a', 'b', 'both'));

ALTER TABLE public.user_special_flashcards
  DROP CONSTRAINT IF EXISTS user_special_flashcards_focus_tag_check;

ALTER TABLE public.user_special_flashcards
  ADD CONSTRAINT user_special_flashcards_focus_tag_check
  CHECK (
    focus_tag IS NULL OR focus_tag IN (
      'grammar',
      'vocabulary',
      'expression',
      'phrasal_verb',
      'pronunciation',
      'translation',
      'natural_usage',
      'other'
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_special_flashcards_focus_tag
  ON public.user_special_flashcards(user_id, focus_tag)
  WHERE focus_tag IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_user_special_flashcards_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_special_flashcards_updated_at ON public.user_special_flashcards;

CREATE TRIGGER trg_user_special_flashcards_updated_at
BEFORE UPDATE ON public.user_special_flashcards
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_special_flashcards_updated_at();

-- A migration original tinha SELECT/INSERT/DELETE. Para editar foco/tag/observação,
-- o usuário precisa poder atualizar somente os próprios registros.
DROP POLICY IF EXISTS "Users can update own special flashcards" ON public.user_special_flashcards;

CREATE POLICY "Users can update own special flashcards"
ON public.user_special_flashcards
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN public.user_special_flashcards.focus_text IS
  'Trecho específico do card que deve ser explicado pela IA.';
COMMENT ON COLUMN public.user_special_flashcards.focus_side IS
  'Lado do card onde o foco aparece: a, b ou both.';
COMMENT ON COLUMN public.user_special_flashcards.focus_tag IS
  'Categoria pedagógica do foco: grammar, vocabulary, expression, phrasal_verb, pronunciation, translation, natural_usage ou other.';
COMMENT ON COLUMN public.user_special_flashcards.focus_note IS
  'Observação livre do professor/aluno sobre a dificuldade a ser explicada.';
