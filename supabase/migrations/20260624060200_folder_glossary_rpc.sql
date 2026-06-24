BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_folder_id_for_list_v1(_list_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT l.folder_id
  FROM public.lists l
  WHERE l.id = _list_id
    AND l.deleted_at IS NULL
    AND l.folder_id IS NOT NULL
    AND public.can_read_folder_glossary(l.folder_id, auth.uid())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_folder_glossary_for_list_v1(_list_id uuid)
RETURNS SETOF public.folder_glossary
LANGUAGE sql
STABLE
AS $$
  SELECT g.*
  FROM public.folder_glossary g
  JOIN public.lists l ON l.folder_id = g.folder_id
  WHERE l.id = _list_id
    AND l.deleted_at IS NULL
    AND g.is_active = true
    AND public.can_read_folder_glossary(g.folder_id, auth.uid())
  ORDER BY g.created_at ASC, g.id ASC;
$$;

CREATE OR REPLACE FUNCTION public.resolve_folder_glossary_access_v1(_folder_id uuid)
RETURNS TABLE(folder_id uuid, owner_id uuid, class_id uuid, can_read boolean, can_manage boolean)
LANGUAGE sql
STABLE
AS $$
  SELECT f.id, f.owner_id, f.class_id, public.can_read_folder_glossary(f.id, auth.uid()), public.can_manage_folder_glossary(f.id, auth.uid())
  FROM public.folders f
  WHERE f.id = _folder_id
    AND f.deleted_at IS NULL
    AND public.can_read_folder_glossary(f.id, auth.uid());
$$;

COMMIT;
