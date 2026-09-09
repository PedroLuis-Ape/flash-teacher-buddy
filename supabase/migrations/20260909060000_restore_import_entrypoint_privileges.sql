-- Supabase's default privileges may grant anon directly. Revoking PUBLIC
-- alone does not revoke those grants. Preserve the authenticated API.
BEGIN;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_classroom_global_import_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_classroom_global_import_v2(uuid) TO authenticated;
-- Internal implementations must only be reached through the checked gateways.
REVOKE ALL ON FUNCTION public.import_smart_list_content_v2_untrusted_settings(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_super_import_skipped_card_v1(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_super_import_duplicate_replacements_v1(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_super_import_updated_cards_v1(uuid) FROM PUBLIC, anon, authenticated;
COMMIT;
