-- Canonical storage configuration for App Piteco visual bundles.
-- Catalog data is synchronized by `npm run store:sync`; records are archived,
-- never deleted, so purchases and inventories keep their stable package IDs.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'piteco-store',
  'piteco-store',
  true,
  8388608,
  array['image/png', 'image/avif']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

create index if not exists skins_catalog_store_visibility_idx
  on public.skins_catalog (is_active, approved, status, type);

create index if not exists public_catalog_store_visibility_idx
  on public.public_catalog (is_active, approved, status, type);

comment on table public.skins_catalog is
  'Authoritative store catalog. Package IDs are stable and referenced by purchases and inventories.';

comment on table public.public_catalog is
  'Public projection of published App Piteco visual bundles.';
