ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS primary_side text NOT NULL DEFAULT 'a';

ALTER TABLE public.lists
  DROP CONSTRAINT IF EXISTS lists_primary_side_check;

ALTER TABLE public.lists
  ADD CONSTRAINT lists_primary_side_check
  CHECK (primary_side IN ('a', 'b'));

ALTER FUNCTION public.import_smart_list_content_v2(uuid, uuid, jsonb, text, uuid, text)
  RENAME TO import_smart_list_content_v2_impl;

CREATE OR REPLACE FUNCTION public.import_smart_list_content_v2(
  _uid uuid,
  _list_id uuid,
  _list jsonb,
  _card_conflict text DEFAULT 'skip',
  _batch_id uuid DEFAULT NULL,
  _list_path text DEFAULT '$'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.import_smart_list_content_v2_impl(
    _uid, _list_id, _list, _card_conflict, _batch_id, _list_path
  );

  UPDATE public.lists
  SET primary_side = CASE
        WHEN lower(COALESCE(_list->>'primary_side', 'a')) = 'b' THEN 'b'
        ELSE 'a'
      END,
      updated_at = now()
  WHERE id = _list_id
    AND owner_id = _uid
    AND deleted_at IS NULL;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.import_smart_list_content_v2_impl(uuid, uuid, jsonb, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2_impl(uuid, uuid, jsonb, text, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.import_smart_list_content_v2(uuid, uuid, jsonb, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_smart_list_content_v2(uuid, uuid, jsonb, text, uuid, text) TO authenticated;
