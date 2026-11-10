-- 011: daily engagement counts for the growth stand-up.
-- Returns numbers only (no text, emails or ids), so it is safe to let the public key call it.
create or replace function public.daily_stats(day date default (now() at time zone 'Asia/Dubai')::date - 1)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select (day::timestamp at time zone 'Asia/Dubai') as t0,
           ((day + 1)::timestamp at time zone 'Asia/Dubai') as t1
  )
  select json_build_object(
    'day', day,
    'reviews',           (select count(*) from reviews, b where created_at >= t0 and created_at < t1),
    'quote_checks',      (select count(*) from quote_checks, b where created_at >= t0 and created_at < t1),
    'contact_whatsapp',  (select count(*) from contacts, b where kind = 'whatsapp' and created_at >= t0 and created_at < t1),
    'contact_call',      (select count(*) from contacts, b where kind = 'call' and created_at >= t0 and created_at < t1),
    'contact_directions',(select count(*) from contacts, b where kind = 'directions' and created_at >= t0 and created_at < t1),
    'suggestions',       (select count(*) from garage_suggestions, b where created_at >= t0 and created_at < t1),
    'coverage_signups',  (select count(*) from coverage_requests, b where created_at >= t0 and created_at < t1),
    'helped_yes',        (select count(*) from feedback, b where helped and created_at >= t0 and created_at < t1),
    'helped_no',         (select count(*) from feedback, b where not helped and created_at >= t0 and created_at < t1),
    'reviews_total',     (select count(*) from reviews),
    'quote_checks_total',(select count(*) from quote_checks)
  );
$$;
revoke all on function public.daily_stats(date) from public;
grant execute on function public.daily_stats(date) to anon, authenticated;
