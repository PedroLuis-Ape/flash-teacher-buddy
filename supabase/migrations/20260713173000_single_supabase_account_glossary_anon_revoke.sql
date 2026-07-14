REVOKE EXECUTE ON FUNCTION public.get_account_glossary_for_list_v1(uuid)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.get_account_glossary_for_list_v1(uuid)
  TO authenticated;
