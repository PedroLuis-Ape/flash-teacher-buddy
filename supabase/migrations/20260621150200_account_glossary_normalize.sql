BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_account_glossary_entries_v1(_entries jsonb)
RETURNS TABLE (
  original_text text,
  translated_text text,
  note text,
  side text,
  is_active boolean
)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (
    upper(CASE WHEN item.side = 'B' THEN 'B' ELSE 'A' END),
    lower(btrim(item.original_text)),
    lower(btrim(item.translated_text))
  )
    btrim(item.original_text),
    btrim(item.translated_text),
    NULLIF(btrim(item.note), ''),
    upper(CASE WHEN item.side = 'B' THEN 'B' ELSE 'A' END),
    COALESCE(item.is_active, true)
  FROM jsonb_to_recordset(
    CASE WHEN jsonb_typeof(_entries) = 'array' THEN _entries ELSE '[]'::jsonb END
  ) AS item(
    original_text text,
    translated_text text,
    note text,
    side text,
    is_active boolean
  )
  WHERE NULLIF(btrim(item.original_text), '') IS NOT NULL
    AND NULLIF(btrim(item.translated_text), '') IS NOT NULL
  ORDER BY
    upper(CASE WHEN item.side = 'B' THEN 'B' ELSE 'A' END),
    lower(btrim(item.original_text)),
    lower(btrim(item.translated_text));
$$;

REVOKE ALL ON FUNCTION public.normalize_account_glossary_entries_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_account_glossary_entries_v1(jsonb) TO authenticated;

COMMIT;
