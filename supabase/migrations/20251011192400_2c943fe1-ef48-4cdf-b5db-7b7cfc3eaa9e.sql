-- Ajuste de herança de visibilidade no portal (listas e cards herdam da pasta)

-- 1) Listas no portal: herdam visibilidade da pasta
CREATE OR REPLACE FUNCTION public.get_portal_lists(_folder_id uuid)
RETURNS SETOF lists
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select l.*
  from public.lists l
  join public.folders f on f.id = l.folder_id
  join public.profiles p on p.id = f.owner_id
  where l.folder_id = _folder_id
    and f.visibility = 'class'
    and coalesce(p.public_access_enabled, false) = true
  order by l.order_index asc, l.created_at asc
$$;

-- 2) Contagens no portal: contam tudo que está dentro da pasta compartilhada
CREATE OR REPLACE FUNCTION public.get_portal_counts(_folder_id uuid)
RETURNS TABLE(list_count integer, card_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select
    (
      select count(*)
      from public.lists l
      join public.folders f on f.id = l.folder_id
      join public.profiles p on p.id = f.owner_id
      where l.folder_id = _folder_id
        and f.visibility = 'class'
        and coalesce(p.public_access_enabled, false) = true
    )::int as list_count,
    (
      select count(*)
      from public.flashcards fc
      join public.lists l on l.id = fc.list_id
      join public.folders f on f.id = l.folder_id
      join public.profiles p on p.id = f.owner_id
      where l.folder_id = _folder_id
        and f.visibility = 'class'
        and coalesce(p.public_access_enabled, false) = true
    )::int as card_count
$$;

-- 3) Flashcards no portal: não exigem visibilidade da lista, apenas da pasta + perfil público
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
    AND f.visibility = 'class'
    AND COALESCE(p.public_access_enabled, false) = true
  ORDER BY fc.created_at ASC
$$;