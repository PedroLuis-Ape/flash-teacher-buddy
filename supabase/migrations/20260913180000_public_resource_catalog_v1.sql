-- Busca, filtros, contagem e facetas do catalogo publico curado (Fase 4).
--
-- Decisao: a RPC continua a reutilizar a regra publica vigente do portal e o
-- quality gate no servidor. A CTE `eligible` e a unica fonte para itens e
-- facetas, impedindo que filtros de UI exponham material nao curado ou
-- contornem o minimo de 8 cards ativos e 90% de termos unicos.
--
-- Backup de producao antes desta migration (2026-09-13, projeto
-- `ymahldldyxvwjeruaxpr`; consulta: pg_get_functiondef + proacl):
--
-- CREATE OR REPLACE FUNCTION public.list_public_resources_v1(_locale text DEFAULT 'pt-BR'::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
--  RETURNS jsonb
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
--   select coalesce(jsonb_agg(item order by item->>'title'), '[]'::jsonb)
--   from (
--     select jsonb_build_object(
--       'slug', e.slug,
--       'title', l.title,
--       'folder_title', f.title,
--       'level', e.level,
--       'theme', e.theme,
--       'resource_type', e.resource_type,
--       'summary', e.summary,
--       'card_count', (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null),
--       'author_name', coalesce(nullif(p.first_name, ''), 'Professor no APE'),
--       'author_slug', p.public_slug,
--       'canonical_path', '/' || e.locale || '/material/' || e.slug,
--       'play_path', '/portal/list/' || l.id::text || '/games'
--     ) as item
--     from public.public_resource_editorial e
--     join public.lists l on l.id = e.list_id
--     join public.folders f on f.id = l.folder_id
--     join public.profiles p on p.id = f.owner_id
--     where e.locale = coalesce(_locale, 'pt-BR')
--       and e.status = 'approved'
--       and e.is_indexable
--       and l.deleted_at is null
--       and f.deleted_at is null
--       and f.visibility = 'class'
--       and f.class_id is null
--       and f.title not ilike '[Atribuição]%'
--       and coalesce(p.public_access_enabled, false)
--       and (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null) >= 8
--     order by l.updated_at desc nulls last
--     limit greatest(0, least(coalesce(_limit, 50), 200))
--     offset greatest(0, coalesce(_offset, 0))
--   ) entries
-- $function$
--
-- ACL anterior exata: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- Equivalencia de grants anterior: anon, authenticated e service_role tinham EXECUTE;
-- PUBLIC nao tinha EXECUTE.
--
-- Rollback (executavel):
-- drop function if exists public.list_public_resources_v1(text, text, text, text, text, integer, integer);
-- create or replace function public.list_public_resources_v1(_locale text default 'pt-BR', _limit integer default 50, _offset integer default 0)
-- returns jsonb language sql stable security definer set search_path = public as $rollback$
--   select coalesce(jsonb_agg(item order by item->>'title'), '[]'::jsonb)
--   from (
--     select jsonb_build_object('slug', e.slug, 'title', l.title, 'folder_title', f.title, 'level', e.level, 'theme', e.theme, 'resource_type', e.resource_type, 'summary', e.summary, 'card_count', (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null), 'author_name', coalesce(nullif(p.first_name, ''), 'Professor no APE'), 'author_slug', p.public_slug, 'canonical_path', '/' || e.locale || '/material/' || e.slug, 'play_path', '/portal/list/' || l.id::text || '/games') as item
--     from public.public_resource_editorial e join public.lists l on l.id = e.list_id join public.folders f on f.id = l.folder_id join public.profiles p on p.id = f.owner_id
--     where e.locale = coalesce(_locale, 'pt-BR') and e.status = 'approved' and e.is_indexable and l.deleted_at is null and f.deleted_at is null and f.visibility = 'class' and f.class_id is null and f.title not ilike '[Atribuição]%' and coalesce(p.public_access_enabled, false) and (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null) >= 8
--     order by l.updated_at desc nulls last limit greatest(0, least(coalesce(_limit, 50), 200)) offset greatest(0, coalesce(_offset, 0))
--   ) entries
-- $rollback$;
-- revoke all on function public.list_public_resources_v1(text, integer, integer) from public, anon, authenticated, service_role;
-- grant execute on function public.list_public_resources_v1(text, integer, integer) to anon, authenticated, service_role;

drop function if exists public.list_public_resources_v1(text, integer, integer);

create or replace function public.list_public_resources_v1(
  _locale text default 'pt-BR',
  _q text default null,
  _level text default null,
  _theme text default null,
  _resource_type text default null,
  _limit integer default 50,
  _offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      e.locale,
      e.slug,
      e.level,
      e.theme,
      e.resource_type,
      e.summary,
      l.id as list_id,
      l.title,
      l.updated_at,
      f.title as folder_title,
      coalesce(nullif(p.first_name, ''), 'Professor no APE') as author_name,
      p.public_slug as author_slug,
      stats.card_count,
      stats.unique_terms
    from public.public_resource_editorial e
    join public.lists l on l.id = e.list_id
    join public.folders f on f.id = l.folder_id
    join public.profiles p on p.id = f.owner_id
    cross join lateral (
      select
        count(*)::integer as card_count,
        count(distinct lower(fc.term))::integer as unique_terms
      from public.flashcards fc
      where fc.list_id = l.id
        and fc.deleted_at is null
    ) stats
    where e.locale = coalesce(nullif(btrim(_locale), ''), 'pt-BR')
      and e.status = 'approved'
      and e.is_indexable
      and l.deleted_at is null
      and f.deleted_at is null
      and f.visibility = 'class'
      and f.class_id is null
      and f.title not ilike '[Atribuição]%'
      and coalesce(p.public_access_enabled, false)
  ),
  eligible as (
    select *
    from base
    where card_count >= 8
      and unique_terms >= ceil(card_count * 0.9)
  ),
  filtered as (
    select *
    from eligible
    where (
      nullif(btrim(_q), '') is null
      or title ilike '%' || nullif(btrim(_q), '') || '%'
      or summary ilike '%' || nullif(btrim(_q), '') || '%'
      or theme ilike '%' || nullif(btrim(_q), '') || '%'
    )
      and (nullif(btrim(_level), '') is null or lower(level) = lower(nullif(btrim(_level), '')))
      and (nullif(btrim(_theme), '') is null or lower(theme) = lower(nullif(btrim(_theme), '')))
      and (nullif(btrim(_resource_type), '') is null or lower(resource_type) = lower(nullif(btrim(_resource_type), '')))
  ),
  total as (select count(*)::integer as count from filtered),
  items as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'slug', page.slug,
          'title', page.title,
          'folder_title', page.folder_title,
          'level', page.level,
          'theme', page.theme,
          'resource_type', page.resource_type,
          'summary', page.summary,
          'card_count', page.card_count,
          'author_name', page.author_name,
          'author_slug', page.author_slug,
          'canonical_path', '/' || page.locale || '/material/' || page.slug,
          'play_path', '/portal/list/' || page.list_id::text || '/games'
        ) order by page.updated_at desc nulls last, page.title asc
      ),
      '[]'::jsonb
    ) as items
    from (
      select *
      from filtered
      order by updated_at desc nulls last, title asc
      limit greatest(0, least(coalesce(_limit, 50), 200))
      offset greatest(0, coalesce(_offset, 0))
    ) page
  ),
  facets as (
    select jsonb_build_object(
      'levels', coalesce((select jsonb_agg(jsonb_build_object('value', value, 'count', count) order by count desc, value asc) from (select level as value, count(*)::integer as count from eligible where level is not null and nullif(btrim(level), '') is not null group by level) level_facets), '[]'::jsonb),
      'themes', coalesce((select jsonb_agg(jsonb_build_object('value', value, 'count', count) order by count desc, value asc) from (select theme as value, count(*)::integer as count from eligible where theme is not null and nullif(btrim(theme), '') is not null group by theme) theme_facets), '[]'::jsonb),
      'resource_types', coalesce((select jsonb_agg(jsonb_build_object('value', value, 'count', count) order by count desc, value asc) from (select resource_type as value, count(*)::integer as count from eligible where resource_type is not null and nullif(btrim(resource_type), '') is not null group by resource_type) resource_type_facets), '[]'::jsonb)
    ) as facets
  )
  select jsonb_build_object(
    'items', items.items,
    'total', total.count,
    'has_more', (greatest(0, coalesce(_offset, 0)) + jsonb_array_length(items.items)) < total.count,
    'facets', facets.facets
  )
  from items cross join total cross join facets;
$$;

revoke all on function public.list_public_resources_v1(text, text, text, text, text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.list_public_resources_v1(text, text, text, text, text, integer, integer) to anon, authenticated, service_role;
