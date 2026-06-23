-- App Piteco — libera lotes do Super Importador 2.0.
-- Migration aditiva e idempotente: preserva todos os lotes existentes.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.global_import_batches') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.global_import_batches não encontrada.';
  END IF;
END;
$$;

ALTER TABLE public.global_import_batches
  DROP CONSTRAINT IF EXISTS global_import_batches_schema_version_check;

ALTER TABLE public.global_import_batches
  ADD CONSTRAINT global_import_batches_schema_version_check
  CHECK (schema_version IN (1, 2)) NOT VALID;

ALTER TABLE public.global_import_batches
  VALIDATE CONSTRAINT global_import_batches_schema_version_check;

COMMENT ON CONSTRAINT global_import_batches_schema_version_check
  ON public.global_import_batches
  IS 'Aceita lotes dos contratos internos de importação 1 e 2.';

COMMIT;
