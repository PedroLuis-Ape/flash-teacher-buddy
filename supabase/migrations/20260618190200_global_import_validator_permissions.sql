-- import_global_package_v2 is SECURITY INVOKER and calls this pure JSON helper.
REVOKE ALL ON FUNCTION public.global_import_json_has_forbidden_key(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.global_import_json_has_forbidden_key(jsonb) TO authenticated;
