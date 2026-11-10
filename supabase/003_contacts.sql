-- Run after 002 (safe to run more than once).
-- North-star metric: garage contacts (WhatsApp, call, directions clicks), with ref/UTM tags.
-- Anyone can insert a contact event; nobody can read them except you in the dashboard.
create table if not exists public.contacts (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  garage_slug text not null check (char_length(garage_slug) <= 120),
  kind        text not null check (kind in ('whatsapp', 'call', 'directions')),
  page        text check (char_length(page) <= 200),
  ref         text check (char_length(ref) <= 80),
  utm_source  text check (char_length(utm_source) <= 80),
  utm_medium  text check (char_length(utm_medium) <= 80),
  utm_campaign text check (char_length(utm_campaign) <= 80)
);
alter table public.contacts enable row level security;
drop policy if exists "insert contact" on public.contacts;
create policy "insert contact" on public.contacts for insert to anon, authenticated with check (true);
grant insert on public.contacts to anon, authenticated;

-- Reviews keep the visitor's ref/UTM tag too (private, never shown).
alter table public.reviews add column if not exists ref text check (ref is null or char_length(ref) <= 120);

-- "My car isn't covered yet" sign-ups. Insert-only for the public; email is never readable.
create table if not exists public.coverage_requests (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email      text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  car        text check (char_length(car) <= 80),
  page       text check (char_length(page) <= 200),
  ref        text check (char_length(ref) <= 80)
);
alter table public.coverage_requests enable row level security;
drop policy if exists "insert request" on public.coverage_requests;
create policy "insert request" on public.coverage_requests for insert to anon, authenticated with check (true);
grant insert on public.coverage_requests to anon, authenticated;
