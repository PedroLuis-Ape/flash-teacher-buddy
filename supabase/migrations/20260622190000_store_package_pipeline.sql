-- Public storage bucket used by the canonical App Piteco package pipeline.
-- Uploads remain restricted to service-role operations performed by the sync script.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'piteco-store',
  'piteco-store',
  true,
  8388608,
  array['image/avif', 'image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
