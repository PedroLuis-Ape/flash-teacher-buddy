create or replace function public.normalize_term_for_check(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(btrim(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

create index if not exists idx_flashcards_user_normalized_term_active
  on public.flashcards (user_id, public.normalize_term_for_check(term))
  where deleted_at is null;

create or replace function public.get_term_duplicate_counts(p_terms text[])
returns table (
  normalized_term text,
  existing_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct public.normalize_term_for_check(raw_term) as normalized_term
    from unnest(coalesce(p_terms, array[]::text[])) as raw_term
  )
  select
    requested.normalized_term,
    count(f.id)::bigint as existing_count
  from requested
  left join public.flashcards f
    on f.user_id = auth.uid()
   and f.deleted_at is null
   and public.normalize_term_for_check(f.term) = requested.normalized_term
  where requested.normalized_term <> ''
  group by requested.normalized_term
  order by requested.normalized_term asc;
$$;

grant execute on function public.get_term_duplicate_counts(text[]) to authenticated;
