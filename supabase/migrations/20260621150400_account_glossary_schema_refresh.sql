BEGIN;

-- Reassert the public API permissions after the account glossary migrations.
REVOKE ALL ON FUNCTION public.import_account_glossary_v1(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_account_glossary_v1(jsonb, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.get_account_glossary_for_list_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_glossary_for_list_v1(uuid) TO anon, authenticated;

COMMIT;

-- PostgREST may still hold the schema snapshot from before these RPCs existed.
NOTIFY pgrst, 'reload schema';
