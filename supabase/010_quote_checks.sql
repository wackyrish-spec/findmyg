-- Run after 009 (safe to run more than once). C5 "Got a dealer quote? Check it": figures only, no garage or customer
-- details. Pending until approved by hand; only approved rows ever feed the price comparisons.
create table if not exists public.quote_checks (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  make       text not null check (char_length(make) <= 40),
  model      text check (char_length(model) <= 60),
  job        text not null check (char_length(job) <= 40),
  aed        integer not null check (aed > 0 and aed < 1000000),
  side       text not null check (side in ('dealer', 'independent')),
  month      text check (month ~ '^\d{4}-\d{2}$'),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);
alter table public.quote_checks enable row level security;
drop policy if exists "insert quote" on public.quote_checks;
create policy "insert quote" on public.quote_checks for insert to anon, authenticated with check (status = 'pending');
grant insert on public.quote_checks to anon, authenticated;
