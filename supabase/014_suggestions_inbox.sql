-- Run after 013 (safe to run more than once).
-- Lets the team read what visitors send us, without a dashboard and without any personal data.
-- Never returned: contact (email/phone), free-text details, reviewer or reporter identity.

-- 1) Garage suggestions and corrections ("Add a garage" form).
create or replace function public.suggestions_inbox(days int default 30)
returns table (created date, kind text, garage_slug text, name text, area text, cars text, is_owner boolean)
language sql stable security definer set search_path = public as $$
  select created_at::date, case kind when 'new' then 'add' else 'correction' end, garage_slug,
         left(name, 120), left(area, 80), left(cars, 200), is_owner
  from garage_suggestions
  where created_at >= now() - make_interval(days => least(greatest(days, 1), 365))
  order by created_at desc limit 200;
$$;
revoke all on function public.suggestions_inbox(int) from public;
grant execute on function public.suggestions_inbox(int) to anon, authenticated;

-- 2) Reports on reviews: what was reported and where, so nothing sits unseen. No details, no contact.
create or replace function public.reports_inbox(days int default 30)
returns table (created date, reporter_type text, reason text, page text, status text)
language sql stable security definer set search_path = public as $$
  select created_at::date, reporter_type, reason, page, status
  from reports
  where created_at >= now() - make_interval(days => least(greatest(days, 1), 365))
  order by created_at desc limit 200;
$$;
revoke all on function public.reports_inbox(int) from public;
grant execute on function public.reports_inbox(int) to anon, authenticated;

-- 3) Problems people searched for that we have no page for (search box "Tell us what's wrong", 11 Nov).
-- Only the search words, cut to 80 characters, grouped and counted.
create or replace function public.problem_demand(days int default 30)
returns table (problem text, searches bigint, last_seen date)
language sql stable security definer set search_path = public as $$
  select lower(left(trim(note), 80)), count(*), max(created_at)::date
  from feedback
  where ref = 'problem-demand' and note is not null
    and created_at >= now() - make_interval(days => least(greatest(days, 1), 365))
  group by 1 order by 2 desc, 3 desc limit 100;
$$;
revoke all on function public.problem_demand(int) from public;
grant execute on function public.problem_demand(int) to anon, authenticated;
