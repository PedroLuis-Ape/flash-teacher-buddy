BEGIN;

ALTER FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text)
  SECURITY DEFINER;
ALTER FUNCTION public.undo_global_import_v2(uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.undo_classroom_global_import_v2(uuid)
  SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.replace_super_import_skipped_card_v1(uuid,text,jsonb) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.apply_super_import_duplicate_replacements_v1(uuid,jsonb) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.restore_super_import_updated_cards_v1(uuid) FROM PUBLIC, authenticated;

REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_global_import_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_classroom_global_import_v2(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_classroom_global_import_v2(uuid) TO authenticated;

COMMIT;
