-- Corrige o canonical_path dos materiais publicos para casar com a URL real.
--
-- Causa-raiz: os RPCs montavam a URL com o code do locale (pt-BR) enquanto o
-- roteamento, o gate de rota publica e o prerender usam o segmento em
-- minusculas (pt-br). O link do catalogo levava o visitante anonimo a uma
-- rota tratada como protegida (pagina vazia / redirect para /auth).
--
-- Backup de producao antes desta migration: as duas funcoes ja existiam e
-- foram apenas recriadas com create or replace. Definicoes anteriores
-- preservadas em 20260913140000_public_resource_editorial_v1.sql e
-- 20260913180000_public_resource_catalog_v1.sql.
--
-- Rollback: reaplicar aquelas duas migrations (create or replace) devolve a
-- expressao anterior.

create or replace function public.get_public_resource_v1(_locale text default 'pt-BR', _slug text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
  v_samples jsonb;
begin
  select e.slug, e.locale, e.level, e.theme, e.resource_type, e.summary, e.reviewed_at,
         l.id, l.title, l.study_type, l.lang_a, l.lang_b,
         f.title as folder_title,
         coalesce(nullif(p.first_name, ''), 'Professor no APE') as author_name,
         p.public_slug as author_slug,
         (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null) as card_count,
         (select count(distinct lower(fc.term)) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null) as unique_terms
    into v_row
  from public.public_resource_editorial e
  join public.lists l on l.id = e.list_id
  join public.folders f on f.id = l.folder_id
  join public.profiles p on p.id = f.owner_id
  where e.locale = coalesce(_locale, 'pt-BR')
    and e.slug = _slug
    and e.status = 'approved'
    and e.is_indexable
    and l.deleted_at is null
    and f.deleted_at is null
    and f.visibility = 'class'
    and f.class_id is null
    and f.title not ilike '[Atribuição]%'
    and coalesce(p.public_access_enabled, false)
  limit 1;

  if not found then
    return jsonb_build_object('source', 'none', 'locale', coalesce(_locale, 'pt-BR'));
  end if;

  if v_row.card_count < 8 or v_row.unique_terms < ceil(v_row.card_count * 0.9) then
    return jsonb_build_object('source', 'none', 'locale', coalesce(_locale, 'pt-BR'), 'reason', 'QUALITY_GATE');
  end if;

  select jsonb_agg(jsonb_build_object('term', x.term, 'translation', x.translation))
    into v_samples
  from (
    select fc.term, fc.translation
    from public.flashcards fc
    where fc.list_id = v_row.id and fc.deleted_at is null
    order by fc.created_at
    limit 8
  ) x;

  return jsonb_build_object(
    'source', 'editorial',
    'locale', v_row.locale,
    'slug', v_row.slug,
    'canonical_path', '/' || lower(v_row.locale) || '/material/' || v_row.slug,
    'play_path', '/portal/list/' || v_row.id::text || '/games',
    'editorial', jsonb_build_object(
      'level', v_row.level,
      'theme', v_row.theme,
      'resource_type', v_row.resource_type,
      'summary', v_row.summary,
      'reviewed_at', v_row.reviewed_at
    ),
    'list', jsonb_build_object(
      'id', v_row.id,
      'title', v_row.title,
      'folder_title', v_row.folder_title,
      'study_type', v_row.study_type,
      'lang_a', v_row.lang_a,
      'lang_b', v_row.lang_b,
      'card_count', v_row.card_count,
      'author_name', v_row.author_name,
      'author_slug', v_row.author_slug
    ),
    'samples', coalesce(v_samples, '[]'::jsonb)
  );
end;
$$;

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
          'canonical_path', '/' || lower(page.locale) || '/material/' || page.slug,
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

revoke all on function public.get_public_resource_v1(text, text) from public;
revoke all on function public.list_public_resources_v1(text, text, text, text, text, integer, integer) from public;
grant execute on function public.get_public_resource_v1(text, text) to anon, authenticated, service_role;
grant execute on function public.list_public_resources_v1(text, text, text, text, text, integer, integer) to anon, authenticated, service_role;
