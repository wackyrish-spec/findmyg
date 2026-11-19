-- 017: count real visits (Arjun 19 Nov: 18 Nov's 56 visits were mostly bots).
-- The site now sends a view only after a scroll or tap (engaged = true) or 5+ seconds on the page before leaving (engaged = false),
-- skips bot user agents and the 404 page. This adds the engaged flag and an engaged-visits number to traffic_stats.
alter table public.page_views add column if not exists engaged boolean;

create or replace function public.traffic_stats(day date default (now() at time zone 'Asia/Dubai')::date - 1, days int default 1)
returns json language sql stable security definer set search_path = public as $$
  with w as (select * from page_views
             where created_at >= (day::timestamp at time zone 'Asia/Dubai')
               and created_at < ((day + days)::timestamp at time zone 'Asia/Dubai'))
  select json_build_object(
    'from', day, 'days', days,
    'views', (select count(*) from w),
    'visits', (select count(*) from w where landing),
    -- A visit whose first counted page had a scroll or tap. Rows from before 19 Nov have engaged = null and are not counted here.
    'engaged_visits', (select count(*) from w where landing and engaged),
    'engaged_views', (select count(*) from w where engaged),
    'mobile_pct', (select round(100.0 * avg(case when mobile then 1 else 0 end)) from w where landing),
    'top_pages', (select coalesce(json_agg(x), '[]') from (select path, count(*) as n from w group by 1 order by 2 desc limit 10) x),
    'top_landing', (select coalesce(json_agg(x), '[]') from (select path, count(*) as n from w where landing group by 1 order by 2 desc limit 10) x),
    'referrers', (select coalesce(json_agg(x), '[]') from (select coalesce(ref_host, 'direct') as host, count(*) as n from w where landing group by 1 order by 2 desc limit 10) x),
    'ref_tags', (select coalesce(json_agg(x), '[]') from (select ref_tag, count(*) as n from w where landing and ref_tag is not null group by 1 order by 2 desc limit 10) x)
  );
$$;
revoke all on function public.traffic_stats(date, int) from public;
grant execute on function public.traffic_stats(date, int) to anon, authenticated;
