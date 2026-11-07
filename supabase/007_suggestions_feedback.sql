-- Run after 006 (safe to run more than once).
-- "Add a garage / suggest a correction" and "Did this help?" feedback. Insert-only for the public;
-- you read them in the table editor.
create table if not exists public.garage_suggestions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('new', 'fix')),
  garage_slug text check (char_length(garage_slug) <= 120),
  name        text check (char_length(name) <= 120),
  area        text check (char_length(area) <= 80),
  cars        text check (char_length(cars) <= 200),
  details     text not null check (char_length(details) between 5 and 1000),
  contact     text check (char_length(contact) <= 200),
  ref         text check (char_length(ref) <= 80)
);
alter table public.garage_suggestions enable row level security;
drop policy if exists "insert suggestion" on public.garage_suggestions;
create policy "insert suggestion" on public.garage_suggestions for insert to anon, authenticated with check (true);
grant insert on public.garage_suggestions to anon, authenticated;

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  page       text not null check (char_length(page) <= 200),
  helped     boolean not null,
  note       text check (char_length(note) <= 300),
  ref        text check (char_length(ref) <= 80)
);
alter table public.feedback enable row level security;
drop policy if exists "insert feedback" on public.feedback;
create policy "insert feedback" on public.feedback for insert to anon, authenticated with check (true);
grant insert on public.feedback to anon, authenticated;
