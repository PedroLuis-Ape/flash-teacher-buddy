BEGIN;

ALTER FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text)
  SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid,uuid,jsonb,text,uuid,text) TO authenticated;

COMMIT;
