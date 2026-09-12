-- Destaque da Home publica + leitura publica do recurso destacado.
--
-- Aplicada em producao (ymahldldyxvwjeruaxpr) em 2026-09-13 pelo editor SQL
-- da Lovable, com verificacao do caminho feliz e do fallback.
--
-- Rollback:
--   delete from public.app_config where key = 'featured_public_resource';
--   drop function if exists public.get_featured_public_resource_v1(text);

insert into public.app_config (key, value)
values ('featured_public_resource', '{"list_id":"a1c6d475-3a69-4b7e-9f7b-877d2480b5f6","order":1}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.get_featured_public_resource_v1(_locale text default 'pt-BR')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_list_id uuid;
  v_source text := 'none';
  v_row record;
  v_samples jsonb;
begin
  begin
    select (value->>'list_id')::uuid into v_list_id
    from public.app_config
    where key = 'featured_public_resource';
  exception when others then
    v_list_id := null;
  end;

  if v_list_id is not null then
    select l.id, l.title, l.study_type, l.lang_a, l.lang_b,
           f.title as folder_title,
           (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null) as card_count,
           coalesce(nullif(p.first_name, ''), 'Professor no APE') as author_name,
           p.public_slug as author_slug
      into v_row
    from public.lists l
    join public.folders f on f.id = l.folder_id
    join public.profiles p on p.id = f.owner_id
    where l.id = v_list_id
      and l.deleted_at is null
      and f.deleted_at is null
      and f.visibility = 'class'
      and f.class_id is null
      and f.title not ilike '[Atribuição]%'
      and coalesce(p.public_access_enabled, false);

    if found then
      v_source := 'config';
    end if;
  end if;

  if v_source = 'none' then
    select l.id, l.title, l.study_type, l.lang_a, l.lang_b,
           f.title as folder_title,
           (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null) as card_count,
           coalesce(nullif(p.first_name, ''), 'Professor no APE') as author_name,
           p.public_slug as author_slug
      into v_row
    from public.lists l
    join public.folders f on f.id = l.folder_id
    join public.profiles p on p.id = f.owner_id
    where l.deleted_at is null
      and f.deleted_at is null
      and f.visibility = 'class'
      and f.class_id is null
      and f.title not ilike '[Atribuição]%'
      and coalesce(p.public_access_enabled, false)
      and (select count(*) from public.flashcards fc where fc.list_id = l.id and fc.deleted_at is null) >= 8
    order by l.updated_at desc nulls last, l.created_at desc
    limit 1;

    if found then
      v_source := 'fallback';
    end if;
  end if;

  if v_source = 'none' then
    return jsonb_build_object('source', 'none', 'locale', coalesce(_locale, 'pt-BR'));
  end if;

  select jsonb_agg(jsonb_build_object('term', x.term, 'translation', x.translation))
    into v_samples
  from (
    select fc.term, fc.translation
    from public.flashcards fc
    where fc.list_id = v_row.id and fc.deleted_at is null
    order by fc.created_at
    limit 3
  ) x;

  return jsonb_build_object(
    'source', v_source,
    'locale', coalesce(_locale, 'pt-BR'),
    'play_path', '/portal/list/' || v_row.id::text || '/games',
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

revoke all on function public.get_featured_public_resource_v1(text) from public;
grant execute on function public.get_featured_public_resource_v1(text) to anon, authenticated, service_role;

