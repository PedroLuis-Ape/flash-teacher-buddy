-- Additive JSON evolution only. No existing card or glossary rows are rewritten.
-- Must be deployed to the data project before accepting extended hints.
CREATE OR REPLACE FUNCTION public.smart_word_hints_for_db_v2(_raw jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'text', item->>'text',
    'translation', item->>'translation',
    'note', NULLIF(BTRIM(item->>'note'), ''),
    'side', COALESCE(NULLIF(item->>'side', ''), 'A'),
    'occurrence', COALESCE(item->'occurrence', '"all"'::jsonb),
    'startIndex', COALESCE(item->'start_index', item->'startIndex'),
    'endIndex', COALESCE(item->'end_index', item->'endIndex'),
    'scope', item->'scope',
    'kind', item->'kind',
    'expression', item->'expression',
    'segments', item->'segments'
  )) ORDER BY ordinal), '[]'::jsonb)
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(_raw) = 'array' THEN _raw ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS hints(item, ordinal);
$$;
-- Pure converter; preserve existing authenticated call contract, no new public API.
REVOKE ALL ON FUNCTION public.smart_word_hints_for_db_v2(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.smart_word_hints_for_db_v2(jsonb) TO authenticated;
