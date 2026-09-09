-- Supabase's default privileges may grant anon directly. Revoking PUBLIC
-- alone does not revoke those grants. Preserve the authenticated API.
BEGIN;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_classroom_global_import_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_classroom_global_import_v2(uuid) TO authenticated;
COMMIT;
