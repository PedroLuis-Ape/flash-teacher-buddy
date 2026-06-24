alter table public.bug_reports
  alter column user_id drop not null,
  add column if not exists reporter_email text;

alter table public.bug_reports
  drop constraint if exists bug_reports_reporter_email_check;

alter table public.bug_reports
  add constraint bug_reports_reporter_email_check
  check (reporter_email is null or char_length(btrim(reporter_email)) between 5 and 254);

create index if not exists bug_reports_created_idx
  on public.bug_reports (created_at desc);

create or replace function public.submit_bug_report_v1(
  p_category text,
  p_severity text,
  p_title text,
  p_description text,
  p_page_url text default null,
  p_user_agent text default null,
  p_reporter_email text default null,
  p_visitor_key text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_website text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user_id uuid := auth.uid();
  v_visitor_key text := nullif(btrim(coalesce(p_visitor_key, '')), '');
begin
  if nullif(btrim(coalesce(p_website, '')), '') is not null then
    raise exception 'invalid submission';
  end if;

  if p_category not in ('bug', 'content', 'access', 'performance', 'suggestion', 'other') then
    raise exception 'invalid category';
  end if;

  if p_severity not in ('low', 'normal', 'high', 'critical') then
    raise exception 'invalid severity';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 140 then
    raise exception 'invalid title';
  end if;

  if char_length(btrim(coalesce(p_description, ''))) not between 10 and 4000 then
    raise exception 'invalid description';
  end if;

  if p_reporter_email is not null and char_length(btrim(p_reporter_email)) not between 5 and 254 then
    raise exception 'invalid email';
  end if;

  if v_user_id is null then
    if v_visitor_key is null or char_length(v_visitor_key) < 16 then
      raise exception 'invalid visitor';
    end if;

    if (
      select count(*)
      from public.bug_reports
      where created_at > now() - interval '1 hour'
        and metadata ->> 'visitor_key' = v_visitor_key
    ) >= 3 then
      raise exception 'rate limit exceeded';
    end if;
  end if;

  insert into public.bug_reports (
    user_id,
    reporter_email,
    category,
    severity,
    title,
    description,
    page_url,
    user_agent,
    metadata
  ) values (
    v_user_id,
    nullif(btrim(coalesce(p_reporter_email, '')), ''),
    p_category,
    p_severity,
    btrim(p_title),
    btrim(p_description),
    nullif(left(coalesce(p_page_url, ''), 1000), ''),
    nullif(left(coalesce(p_user_agent, ''), 1000), ''),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('visitor_key', v_visitor_key, 'authenticated', v_user_id is not null)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_bug_report_v1(text, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function public.submit_bug_report_v1(text, text, text, text, text, text, text, text, jsonb, text) to anon, authenticated;

revoke insert on public.bug_reports from anon;
