-- GarageGuide owner reviews. Run once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  garage_slug         text not null check (char_length(garage_slug) between 1 and 120),
  display_name        text check (char_length(display_name) <= 40),
  car_make            text not null check (char_length(car_make) between 1 and 40),
  car_model           text check (char_length(car_model) <= 60),
  car_year            int  check (car_year between 1950 and 2035),
  job                 text not null check (char_length(job) between 2 and 120),
  price_paid          int  check (price_paid between 0 and 2000000),
  quote_vs_final      text check (quote_vs_final in ('same', 'higher', 'lower')),
  knew_car            text check (knew_car in ('expert', 'good', 'average', 'poor')),
  rating              int  not null check (rating between 1 and 5),
  showed_old_parts    boolean not null default false,
  called_before_extra boolean not null default false,
  would_return        boolean not null default false,
  body                text not null check (char_length(body) between 40 and 4000),
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  unique (user_id, garage_slug)            -- one review per person per garage
);

create index if not exists reviews_garage_idx on public.reviews (garage_slug) where status = 'approved';

alter table public.reviews enable row level security;

-- Anyone can read approved reviews (the site reads these at build time).
drop policy if exists "read approved" on public.reviews;
create policy "read approved" on public.reviews for select using (status = 'approved');

-- Signed-in owners can see their own reviews, including pending ones.
drop policy if exists "read own" on public.reviews;
create policy "read own" on public.reviews for select to authenticated using (auth.uid() = user_id);

-- Signed-in owners can add a review for themselves. It always starts as pending.
drop policy if exists "insert own pending" on public.reviews;
create policy "insert own pending" on public.reviews for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

-- No update or delete policies: moderation happens in the Supabase table editor
-- (set status to 'approved' or 'rejected').

-- Don't expose reviewers' account ids publicly.
revoke select on public.reviews from anon;
grant select (id, created_at, garage_slug, display_name, car_make, car_model, car_year, job, price_paid,
  quote_vs_final, knew_car, rating, showed_old_parts, called_before_extra, would_return, body)
  on public.reviews to anon;
grant insert on public.reviews to authenticated;
