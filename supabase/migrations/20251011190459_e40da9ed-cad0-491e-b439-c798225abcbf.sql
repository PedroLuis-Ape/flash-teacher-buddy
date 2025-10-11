-- Public portal RPCs to allow anonymous read access via security definer
create or replace function public.get_portal_folders()
returns setof public.folders
language sql
stable
security definer
set search_path = public
as $$
  select f.*
  from public.folders f
  join public.profiles p on p.id = f.owner_id
  where f.visibility = 'class'
    and coalesce(p.public_access_enabled, false) = true
  order by f.created_at desc
$$;

create or replace function public.get_portal_folder(_id uuid)
returns public.folders
language sql
stable
security definer
set search_path = public
as $$
  select f.*
  from public.folders f
  join public.profiles p on p.id = f.owner_id
  where f.id = _id
    and f.visibility = 'class'
    and coalesce(p.public_access_enabled, false) = true
$$;

create or replace function public.get_portal_lists(_folder_id uuid)
returns setof public.lists
language sql
stable
security definer
set search_path = public
as $$
  select l.*
  from public.lists l
  join public.folders f on f.id = l.folder_id
  join public.profiles p on p.id = f.owner_id
  where l.folder_id = _folder_id
    and l.visibility = 'class'
    and f.visibility = 'class'
    and coalesce(p.public_access_enabled, false) = true
  order by l.order_index asc
$$;

create or replace function public.get_portal_counts(_folder_id uuid)
returns table(list_count integer, card_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.lists l where l.folder_id = _folder_id and l.visibility = 'class')::int as list_count,
    (select count(*) from public.flashcards fc where fc.list_id in (select id from public.lists where folder_id = _folder_id and visibility = 'class'))::int as card_count
$$;

-- Grant execute to anon and authenticated roles
grant execute on function public.get_portal_folders() to anon, authenticated;
grant execute on function public.get_portal_folder(uuid) to anon, authenticated;
grant execute on function public.get_portal_lists(uuid) to anon, authenticated;
grant execute on function public.get_portal_counts(uuid) to anon, authenticated;