-- Mantém todos os chamadores legados compatíveis com a chave canônica v2.
-- Fluxos antigos continuam chamando import_folder_glossary_v1, mas passam a
-- usar a implementação set-based que reconhece Unicode, espaços e pontuação.

BEGIN;

CREATE OR REPLACE FUNCTION public.import_folder_glossary_v1(
  _folder_id uuid,
  _entries jsonb,
  _mode text DEFAULT 'merge',
  _dry_run boolean DEFAULT false
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT public.import_folder_glossary_v2(
    _folder_id,
    _entries,
    _mode,
    _dry_run
  );
$$;

REVOKE ALL ON FUNCTION public.import_folder_glossary_v1(uuid,jsonb,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_folder_glossary_v1(uuid,jsonb,text,boolean) TO authenticated;

COMMIT;
