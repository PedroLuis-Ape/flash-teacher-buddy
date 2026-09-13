-- Camada de curadoria e leitura dos materiais publicos (Fase 4).
--
-- Decisao: reutiliza a regra publica que JA funciona no portal
-- (`folders.visibility='class'`, `class_id IS NULL`, dono com
-- `public_access_enabled`, titulo fora de `[Atribuição]%`). O registro moderno
-- de publicacoes (`public_entity_publications`) NAO existe no banco de
-- producao; em vez de introduzir um segundo sistema de publicacao, a curadoria
-- editorial entra como camada adicional sobre a regra vigente.
--
-- Quality gate aplicado no servidor: >= 8 cards e >= 90% de termos unicos.
--
-- Rollback:
--   drop function if exists public.list_public_resources_v1(text, integer, integer);
--   drop function if exists public.get_public_resource_v1(text, text);
--   drop table if exists public.public_resource_editorial;

create table if not exists public.public_resource_editorial (
  list_id uuid not null references public.lists(id) on delete cascade,
  locale text not null default 'pt-BR',
  slug text not null,
  level text,
  theme text,
  resource_type text,
  summary text,
  status text not null default 'draft',
  is_indexable boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_id, locale),
  constraint public_resource_editorial_slug_key unique (locale, slug),
  constraint public_resource_editorial_status_check check (status in ('draft', 'approved', 'retired'))
);

alter table public.public_resource_editorial enable row level security;
-- Sem policy: acesso apenas por RPC SECURITY DEFINER (deny-all para a API).
revoke all on table public.public_resource_editorial from public, anon, authenticated;

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
    'canonical_path', '/' || v_row.locale || '/material/' || v_row.slug,
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
  _limit integer default 50,
  _offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(item order by item->>'title'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'slug', e.slug,
      'title', l.title,
      'folder_title', f.title,
      'level', e.level,
      'theme', e.theme,
      'resource_type', e.resource_type,
      'summary', e.summary,
      'card_count', (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null),
      'author_name', coalesce(nullif(p.first_name, ''), 'Professor no APE'),
      'author_slug', p.public_slug,
      'canonical_path', '/' || e.locale || '/material/' || e.slug,
      'play_path', '/portal/list/' || l.id::text || '/games'
    ) as item
    from public.public_resource_editorial e
    join public.lists l on l.id = e.list_id
    join public.folders f on f.id = l.folder_id
    join public.profiles p on p.id = f.owner_id
    where e.locale = coalesce(_locale, 'pt-BR')
      and e.status = 'approved'
      and e.is_indexable
      and l.deleted_at is null
      and f.deleted_at is null
      and f.visibility = 'class'
      and f.class_id is null
      and f.title not ilike '[Atribuição]%'
      and coalesce(p.public_access_enabled, false)
      and (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null) >= 8
    order by l.updated_at desc nulls last
    limit greatest(0, least(coalesce(_limit, 50), 200))
    offset greatest(0, coalesce(_offset, 0))
  ) entries
$$;

revoke all on function public.get_public_resource_v1(text, text) from public;
revoke all on function public.list_public_resources_v1(text, integer, integer) from public;
grant execute on function public.get_public_resource_v1(text, text) to anon, authenticated, service_role;
grant execute on function public.list_public_resources_v1(text, integer, integer) to anon, authenticated, service_role;

-- Sementes de curadoria: entram como RASCUNHO. Nada fica indexavel antes da
-- revisao humana (status -> 'approved' + is_indexable = true).
insert into public.public_resource_editorial (list_id, locale, slug, level, theme, resource_type, summary, status, is_indexable)
values
  ('a1c6d475-3a69-4b7e-9f7b-877d2480b5f6', 'pt-BR', 'verbo-to-be-presente-afirmativo', 'A1', 'verbo to be', 'frases',
   'Frases afirmativas com o verbo to be no presente (am, is, are) em situacoes do dia a dia: familia, rotina, escola e tempo.', 'draft', false),
  ('279c8d86-ed46-42d6-abdb-b596da2464ed', 'pt-BR', 'verbo-to-be-passado-afirmativo', 'A1', 'verbo to be', 'frases',
   'Frases afirmativas no passado com was e were, com marcadores de tempo como yesterday, last weekend e last year.', 'draft', false),
  ('af8dbc84-9496-4b08-8b5d-f008cd9b7932', 'pt-BR', 'verbo-to-be-presente-interrogativo', 'A1', 'verbo to be', 'perguntas',
   'Perguntas no presente com am, is e are em contextos de reuniao, festa, sala de aula e situacoes do cotidiano.', 'draft', false),
  ('9dcdd3dd-faa7-4ab9-9f40-2f1a3ce780b0', 'pt-BR', 'pedir-informacoes-ingles', 'A1', 'viagem e comunicacao', 'frases uteis',
   'Frases praticas para pedir informacoes em ingles: repetir, perguntar horario, pedir ajuda no mapa e localizar estacoes.', 'draft', false),
  ('11ea75fd-aa17-4563-8786-1b17ffd4e19f', 'pt-BR', 'verbos-irregulares-tres-formas', 'A2', 'verbos irregulares', 'vocabulario',
   'Verbos irregulares em tres formas (presente, passado e gerundio) com traducao, para automatizar a conjugacao.', 'draft', false)
on conflict (list_id, locale) do nothing;

