-- Função para buscar flashcards de uma lista pública via portal
CREATE OR REPLACE FUNCTION public.get_portal_flashcards(_list_id uuid)
RETURNS SETOF flashcards
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT fc.*
  FROM public.flashcards fc
  JOIN public.lists l ON l.id = fc.list_id
  JOIN public.folders f ON f.id = l.folder_id
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE fc.list_id = _list_id
    AND l.visibility = 'class'
    AND f.visibility = 'class'
    AND COALESCE(p.public_access_enabled, false) = true
  ORDER BY fc.created_at ASC
$$;