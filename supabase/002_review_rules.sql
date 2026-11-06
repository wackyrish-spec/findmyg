-- Run after schema.sql (safe to run more than once).
-- Product spec 11b: one review per account per garage every 6 months,
-- plus an optional private WhatsApp number that is never shown publicly.

alter table public.reviews add column if not exists whatsapp text
  check (whatsapp is null or whatsapp ~ '^\+?[0-9 ]{7,20}$');

-- Replace the permanent one-review rule with a 6-month window.
alter table public.reviews drop constraint if exists reviews_user_id_garage_slug_key;

create or replace function public.reviews_six_month_rule() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.reviews
    where user_id = new.user_id and garage_slug = new.garage_slug
      and created_at > now() - interval '6 months'
  ) then
    raise exception 'recent_review: one review per garage every 6 months' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists reviews_six_month_rule on public.reviews;
create trigger reviews_six_month_rule before insert on public.reviews
  for each row execute function public.reviews_six_month_rule();

-- The anon column grant in schema.sql already leaves whatsapp out, so it is never public.
-- Signed-in owners may insert it with their own review:
grant insert on public.reviews to authenticated;

-- Product spec 11a: optional "did a main dealer quote you for this job?" amount (AED).
-- Public, so the dealer comparison strip can show a range once a job has 3+ reports.
alter table public.reviews add column if not exists dealer_quote int
  check (dealer_quote is null or dealer_quote between 0 and 2000000);
grant select (dealer_quote) on public.reviews to anon;
