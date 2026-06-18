-- Recreate the pure recursive validator with PostgreSQL's default EXECUTE
-- privilege. It only inspects the JSON argument and has no table access.
DROP FUNCTION IF EXISTS public.global_import_json_has_forbidden_key(jsonb);

CREATE FUNCTION public.global_import_json_has_forbidden_key(_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  pair record;
  child jsonb;
BEGIN
  IF jsonb_typeof(_value) = 'object' THEN
    FOR pair IN SELECT key, value FROM jsonb_each(_value) LOOP
      IF pair.key IN (
        '__proto__', 'prototype', 'constructor',
        'owner_id', 'user_id', 'institution_id',
        'folder_id', 'list_id', 'parent_card_id',
        'created_at', 'updated_at', 'deleted_at'
      ) THEN
        RETURN true;
      END IF;
      IF public.global_import_json_has_forbidden_key(pair.value) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(_value) = 'array' THEN
    FOR child IN SELECT value FROM jsonb_array_elements(_value) LOOP
      IF public.global_import_json_has_forbidden_key(child) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;
