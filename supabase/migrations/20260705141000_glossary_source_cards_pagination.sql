-- Optimizes the folder/list glossary export picker for large folders.
-- The UI can request a small page of source cards instead of loading
-- thousands of flashcards into the browser at once.

create index if not exists idx_flashcards_active_list_created_id
  on public.flashcards (list_id, created_at, id)
  where deleted_at is null;

create or replace function public.get_glossary_source_cards_page(
  p_list_ids uuid[],
  p_limit integer default 250,
  p_offset integer default 0
)
returns table (
  id uuid,
  list_id uuid,
  term text,
  translation text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      f.id,
      f.list_id,
      f.term,
      f.translation,
      f.created_at
    from public.flashcards f
    where f.list_id = any(coalesce(p_list_ids, array[]::uuid[]))
      and f.deleted_at is null
      and (
        nullif(btrim(coalesce(f.term, '')), '') is not null
        or nullif(btrim(coalesce(f.translation, '')), '') is not null
      )
  )
  select
    filtered.id,
    filtered.list_id,
    filtered.term,
    filtered.translation,
    count(*) over() as total_count
  from filtered
  order by filtered.created_at asc, filtered.id asc
  limit greatest(0, least(coalesce(p_limit, 250), 1000))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.get_glossary_source_cards_page(uuid[], integer, integer) to anon, authenticated;
