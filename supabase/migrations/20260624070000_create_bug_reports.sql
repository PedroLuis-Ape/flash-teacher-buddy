create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'bug',
  severity text not null default 'normal',
  title text not null,
  description text not null,
  page_url text,
  user_agent text,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bug_reports_category_check check (category in ('bug', 'content', 'access', 'performance', 'suggestion', 'other')),
  constraint bug_reports_severity_check check (severity in ('low', 'normal', 'high', 'critical')),
  constraint bug_reports_status_check check (status in ('open', 'reviewing', 'resolved', 'closed')),
  constraint bug_reports_title_length check (char_length(btrim(title)) between 3 and 140),
  constraint bug_reports_description_length check (char_length(btrim(description)) between 10 and 4000)
);

alter table public.bug_reports enable row level security;

create index if not exists bug_reports_user_created_idx on public.bug_reports (user_id, created_at desc);
create index if not exists bug_reports_status_created_idx on public.bug_reports (status, created_at desc);

create or replace function public.set_bug_reports_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bug_reports_updated_at on public.bug_reports;
create trigger trg_bug_reports_updated_at
before update on public.bug_reports
for each row execute function public.set_bug_reports_updated_at();

drop policy if exists "Users can create their own bug reports" on public.bug_reports;
create policy "Users can create their own bug reports"
on public.bug_reports
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own bug reports" on public.bug_reports;
create policy "Users can read their own bug reports"
on public.bug_reports
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can update draft fields on own open bug reports" on public.bug_reports;
create policy "Users can update draft fields on own open bug reports"
on public.bug_reports
for update
to authenticated
using (auth.uid() = user_id and status = 'open')
with check (auth.uid() = user_id and status = 'open');

grant select, insert, update on public.bug_reports to authenticated;

drop view if exists public.bug_reports_admin_summary;
create view public.bug_reports_admin_summary
with (security_invoker = true) as
select
  id,
  user_id,
  category,
  severity,
  title,
  status,
  page_url,
  created_at,
  updated_at
from public.bug_reports;
