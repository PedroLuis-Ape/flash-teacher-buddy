
REVOKE EXECUTE ON FUNCTION public.get_own_public_teacher_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_public_teacher_settings(text, text[], boolean, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_own_public_teacher_folders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_public_teacher_folder_visibility(uuid, boolean) FROM anon;
