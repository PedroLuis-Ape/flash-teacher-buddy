-- Fase 5, Task 2: eventos first-party de produto.
--
-- Decisao: medir ativacao sem PII e sem terceiros. A tabela e insert-only para
-- o cliente: RLS habilitada, nenhuma policy e revogacao total de public/anon/
-- authenticated. Todo acesso passa pela RPC SECURITY DEFINER abaixo.
--
-- Contratos que NAO podem ser afrouxados: allowlist fechada de nomes, filtragem
-- de chaves por evento, limite de tamanho do payload e throttle por janela.
--
-- Rollback:
--   drop function if exists public.record_product_event_v1(text, jsonb, text, text);
--   drop table if exists public.product_event;

create table if not exists public.product_event (
  id bigserial primary key,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  locale text,
  surface text,
  occurred_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  constraint product_event_name_check check (
    name in (
      'featured_resource_impression',
      'featured_resource_play',
      'public_resource_view',
      'public_search_used',
      'guest_game_start',
      'guest_game_complete',
      'guest_resume',
      'signup_sync_cta_view',
      'signup_after_guest',
      'carousel_slide_view',
      'carousel_interaction'
    )
  ),
  constraint product_event_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint product_event_payload_size_check check (octet_length(payload::text) <= 512)
);

alter table public.product_event enable row level security;
-- Sem policy: o cliente nunca le a tabela. A leitura e do time, via service_role.
revoke all on table public.product_event from public, anon, authenticated;

create index if not exists product_event_name_created_at_idx
  on public.product_event (name, created_at desc);

create or replace function public.record_product_event_v1(
  _name text,
  _payload jsonb default '{}'::jsonb,
  _locale text default 'pt-BR',
  _surface text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed_keys text[];
  v_payload jsonb;
  v_recent integer;
  v_payload_limit constant integer := 512;
  v_throttle_limit constant integer := 300;
begin
  v_allowed_keys := case _name
    when 'featured_resource_impression' then array['resource_slug', 'position']
    when 'featured_resource_play' then array['resource_slug']
    when 'public_resource_view' then array['resource_slug', 'locale']
    when 'public_search_used' then array['result_count', 'has_filters']
    when 'guest_game_start' then array['mode']
    when 'guest_game_complete' then array['mode', 'round_count']
    when 'guest_resume' then array['mode']
    when 'signup_sync_cta_view' then array[]::text[]
    when 'signup_after_guest' then array['outcome']
    when 'carousel_slide_view' then array['slide_index']
    when 'carousel_interaction' then array['slide_index', 'action']
    else null
  end;

  -- Nome fora da allowlist nao vira erro que revele a lista: descarte silencioso.
  if v_allowed_keys is null then
    return jsonb_build_object('accepted', false, 'reason', 'unknown_event');
  end if;

  if _payload is null or jsonb_typeof(_payload) <> 'object' then
    return jsonb_build_object('accepted', false, 'reason', 'invalid_payload');
  end if;

  -- Somente chaves previstas para aquele evento sobrevivem.
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
    into v_payload
  from jsonb_each(_payload) as entry
  where key = any(v_allowed_keys);

  if octet_length(v_payload::text) > v_payload_limit then
    return jsonb_build_object('accepted', false, 'reason', 'payload_too_large');
  end if;

  -- Throttle por nome numa janela curta. Limite global documentado: um cliente
  -- abusivo pode consumir a cota daquele nome na janela.
  select count(*) into v_recent
  from public.product_event pe
  where pe.name = _name
    and pe.created_at > now() - interval '1 minute';

  if v_recent >= v_throttle_limit then
    return jsonb_build_object('accepted', false, 'reason', 'throttled');
  end if;

  insert into public.product_event (name, payload, locale, surface)
  values (
    _name,
    v_payload,
    nullif(left(coalesce(_locale, ''), 16), ''),
    nullif(left(coalesce(_surface, ''), 64), '')
  );

  return jsonb_build_object('accepted', true, 'name', _name);
end;
$$;

revoke all on function public.record_product_event_v1(text, jsonb, text, text) from public;
grant execute on function public.record_product_event_v1(text, jsonb, text, text) to anon, authenticated, service_role;

