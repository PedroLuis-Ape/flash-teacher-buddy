-- Optional database optimizations for the App Piteco package manager.
--
-- Bucket creation and MIME configuration are handled idempotently by
-- `npm run store:sync`. Keeping Storage lifecycle out of SQL makes local
-- `supabase db reset` independent from the bundled Storage schema version.
-- Catalog rows are archived, never deleted, so purchases and inventories keep
-- their stable package IDs.

do $$
begin
  if to_regclass('public.skins_catalog') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'skins_catalog'
         and column_name in ('is_active', 'approved', 'status', 'type')
       group by table_schema, table_name
       having count(*) = 4
     ) then
    create index if not exists skins_catalog_store_visibility_idx
      on public.skins_catalog (is_active, approved, status, type);
  end if;

  if to_regclass('public.public_catalog') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'public_catalog'
         and column_name in ('is_active', 'approved', 'status', 'type')
       group by table_schema, table_name
       having count(*) = 4
     ) then
    create index if not exists public_catalog_store_visibility_idx
      on public.public_catalog (is_active, approved, status, type);
  end if;
end
$$;

do $$
begin
  if to_regclass('public.skins_catalog') is not null then
    comment on table public.skins_catalog is
      'Authoritative store catalog. Package IDs are stable and referenced by purchases and inventories.';
  end if;

  if to_regclass('public.public_catalog') is not null then
    comment on table public.public_catalog is
      'Public projection of published App Piteco visual bundles.';
  end if;
end
$$;
