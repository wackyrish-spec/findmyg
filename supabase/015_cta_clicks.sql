-- 015: every tap on a contact or view control, with where it happened. Safe to run more than once.
-- Why: compare contact clicks per list view before and after a card change (baseline for card B, 21 Nov).
-- Stored: kind, garage slug, page path, page type, card or page, card position, phone or not. No cookies, no IP, no ids.
create table if not exists public.cta_clicks (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('whatsapp_open', 'whatsapp', 'call', 'directions', 'view', 'quote', 'review')),
  garage_slug text check (char_length(garage_slug) <= 120),
  page        text check (char_length(page) <= 200),
  page_type   text check (char_length(page_type) <= 20),
  place       text check (place in ('card', 'page')),
  position    int check (position between 1 and 500),
  mobile      boolean
);
create index if not exists cta_clicks_created_at on public.cta_clicks (created_at);
alter table public.cta_clicks enable row level security;
drop policy if exists "anyone can log a click" on public.cta_clicks;
create policy "anyone can log a click" on public.cta_clicks for insert to anon, authenticated with check (true);
grant insert on public.cta_clicks to anon, authenticated;

-- Totals for the stand-up: clicks by kind, by page type, by card position, and list views for the same days
-- (from page_views) so the team can work out contact clicks per list view. Counts only, no rows.
create or replace function public.cta_stats(day date default (now() at time zone 'Asia/Dubai')::date - 1, days int default 1)
returns json language sql stable security definer set search_path = public as $$
  with w as (select * from cta_clicks
             where created_at >= (day::timestamp at time zone 'Asia/Dubai')
               and created_at < ((day + days)::timestamp at time zone 'Asia/Dubai')),
       v as (select * from page_views
             where created_at >= (day::timestamp at time zone 'Asia/Dubai')
               and created_at < ((day + days)::timestamp at time zone 'Asia/Dubai'))
  select json_build_object(
    'from', day, 'days', days,
    'clicks', (select count(*) from w),
    'contact_clicks', (select count(*) from w where kind in ('whatsapp_open', 'call', 'directions')),
    'card_contact_clicks', (select count(*) from w where place = 'card' and kind in ('whatsapp_open', 'call', 'directions')),
    'list_views', (select count(*) from v where path ~ '^/dubai/' and path !~ '(/issues/|/service-cost/)$'),
    'garage_page_views', (select count(*) from v where path ~ '^/garage/'),
    'by_kind', (select coalesce(json_agg(x), '[]') from (select kind, place, count(*) as n from w group by 1, 2 order by 3 desc) x),
    'by_page_type', (select coalesce(json_agg(x), '[]') from (select page_type, kind, count(*) as n from w group by 1, 2 order by 3 desc limit 40) x),
    'by_position', (select coalesce(json_agg(x), '[]') from (select position, count(*) as n from w where place = 'card' and position is not null group by 1 order by 1 limit 30) x),
    'top_garages', (select coalesce(json_agg(x), '[]') from (select garage_slug, count(*) as n from w where garage_slug is not null and kind <> 'view' group by 1 order by 2 desc limit 10) x)
  );
$$;
revoke all on function public.cta_stats(date, int) from public;
grant execute on function public.cta_stats(date, int) to anon, authenticated;
