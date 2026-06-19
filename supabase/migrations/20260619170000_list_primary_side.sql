-- App Piteco: lado principal persistente por lista.
-- Não move term/translation nem altera idiomas/rótulos.

ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS primary_side text NOT NULL DEFAULT 'a';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.lists'::regclass
      AND conname = 'lists_primary_side_check'
  ) THEN
    ALTER TABLE public.lists
      ADD CONSTRAINT lists_primary_side_check
      CHECK (primary_side IN ('a', 'b'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.lists.primary_side IS
  'Lado A/B que inicia os jogos por padrão sem mover conteúdo ou idiomas.';
