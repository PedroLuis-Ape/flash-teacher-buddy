BEGIN;

CREATE OR REPLACE FUNCTION public.get_folder_glossary_for_list_v1(_list_id uuid)
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  original_text text,
  translated_text text,
  note text,
  side text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    g.id,
    g.owner_id,
    g.original_text,
    array_to_string(
      array_prepend(g.primary_translation, COALESCE(g.alternative_translations, '{}'::text[])),
      ', '
    ) AS translated_text,
    g.note,
    g.side,
    g.is_active,
    g.created_at,
    g.updated_at
  FROM public.lists l
  JOIN public.folder_glossary g ON g.folder_id = l.folder_id
  WHERE l.id = _list_id
    AND l.deleted_at IS NULL
    AND g.is_active = true
  ORDER BY lower(g.original_text), g.side, g.created_at;
$$;

COMMIT;
