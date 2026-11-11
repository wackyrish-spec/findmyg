-- 013: our own anonymous page counter, so the team sees visits without a dashboard login.
-- Stored: page path, referring site (host only), our ?ref tag, whether it's the first page of the visit. No cookies, no IP, no ids.
create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path       text not null check (char_length(path) <= 200),
  ref_host   text check (char_length(ref_host) <= 100),
  ref_tag    text check (char_length(ref_tag) <= 80),
  landing    boolean not null default false,
  mobile     boolean
);
create index if not exists page_views_created_at on public.page_views (created_at);
alter table public.page_views enable row level security;
drop policy if exists "anyone can count a view" on public.page_views;
create policy "anyone can count a view" on public.page_views for insert to anon, authenticated with check (true);

-- Daily traffic for the stand-up: views, visits (landings), mobile share, top pages, top referrers, top ref tags.
create or replace function public.traffic_stats(day date default (now() at time zone 'Asia/Dubai')::date - 1, days int default 1)
returns json language sql stable security definer set search_path = public as $$
  with w as (select * from page_views
             where created_at >= (day::timestamp at time zone 'Asia/Dubai')
               and created_at < ((day + days)::timestamp at time zone 'Asia/Dubai'))
  select json_build_object(
    'from', day, 'days', days,
    'views', (select count(*) from w),
    'visits', (select count(*) from w where landing),
    'mobile_pct', (select round(100.0 * avg(case when mobile then 1 else 0 end)) from w where landing),
    'top_pages', (select coalesce(json_agg(x), '[]') from (select path, count(*) as n from w group by 1 order by 2 desc limit 10) x),
    'top_landing', (select coalesce(json_agg(x), '[]') from (select path, count(*) as n from w where landing group by 1 order by 2 desc limit 10) x),
    'referrers', (select coalesce(json_agg(x), '[]') from (select coalesce(ref_host, 'direct') as host, count(*) as n from w where landing group by 1 order by 2 desc limit 10) x),
    'ref_tags', (select coalesce(json_agg(x), '[]') from (select ref_tag, count(*) as n from w where landing and ref_tag is not null group by 1 order by 2 desc limit 10) x)
  );
$$;
revoke all on function public.traffic_stats(date, int) from public;
grant execute on function public.traffic_stats(date, int) to anon, authenticated;
