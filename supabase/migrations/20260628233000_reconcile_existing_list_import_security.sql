BEGIN;

-- This migration is intentionally repeatable. It repairs environments where
-- the feature functions were created but the final security/undo migration was
-- not recorded or did not finish.

ALTER FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text)
  SECURITY DEFINER;
ALTER FUNCTION public.import_smart_list_content_v2_untrusted_settings(uuid,uuid,jsonb,text,uuid,text)
  SECURITY INVOKER;
ALTER FUNCTION public.replace_super_import_skipped_card_v1(uuid,text,jsonb)
  SECURITY INVOKER;
ALTER FUNCTION public.apply_super_import_duplicate_replacements_v1(uuid,jsonb)
  SECURITY INVOKER;
ALTER FUNCTION public.restore_super_import_updated_cards_v1(uuid)
  SECURITY INVOKER;
ALTER FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text)
  SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.undo_global_import_v2(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.restore_super_import_updated_cards_v1(_batch_id);
  PERFORM public.undo_global_import_v1(_batch_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_classroom_global_import_v2(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.restore_super_import_updated_cards_v1(_batch_id);
  PERFORM public.undo_classroom_global_import_v1(_batch_id);
END;
$$;

REVOKE ALL ON FUNCTION public.import_smart_list_content_v2_untrusted_settings(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.replace_super_import_skipped_card_v1(uuid,text,jsonb) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.apply_super_import_duplicate_replacements_v1(uuid,jsonb) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.restore_super_import_updated_cards_v1(uuid) FROM PUBLIC, authenticated;

REVOKE ALL ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_global_import_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_classroom_global_import_v2(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_v3(uuid,jsonb,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_to_class_v2(uuid,jsonb,jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_classroom_global_import_v2(uuid) TO authenticated;

COMMIT;
