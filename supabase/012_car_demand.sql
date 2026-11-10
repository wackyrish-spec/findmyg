-- 012: which uncovered cars people look for (PM no-dead-ends). No personal data: make, model, state, page, time.
create table if not exists public.car_demand (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  make       text not null check (char_length(make) <= 40),
  model      text check (char_length(model) <= 60),
  state      text not null check (state in ('B', 'C')),
  page       text check (char_length(page) <= 200)
);
alter table public.car_demand enable row level security;
drop policy if exists "anyone can log demand" on public.car_demand;
create policy "anyone can log demand" on public.car_demand for insert to anon, authenticated with check (true);

-- Counts for Data's reading queue and the Monday top-10: cars people looked for plus "tell me when covered" sign-ups.
create or replace function public.coverage_top(days int default 7)
returns table (make text, model text, views bigint, signups bigint)
language sql stable security definer set search_path = public as $$
  with v as (select make, coalesce(model, '') as model, count(*) as n from car_demand
             where created_at >= now() - make_interval(days => days) group by 1, 2),
       s as (select coalesce(car, '') as car, count(*) as n from coverage_requests
             where created_at >= now() - make_interval(days => days) group by 1)
  select v.make, nullif(v.model, ''), v.n,
         coalesce((select sum(s.n) from s where lower(s.car) like lower(v.make || '%' || v.model || '%')), 0)::bigint
  from v order by v.n desc limit 50;
$$;
revoke all on function public.coverage_top(int) from public;
grant execute on function public.coverage_top(int) to anon, authenticated;
