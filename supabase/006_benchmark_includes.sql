-- Run after 005 (safe to run more than once).
-- Cost benchmark (research/cost-benchmark-decision.md): "What was included?" ticks for
-- minor service, front brake pads and AC re-gas. Shown publicly next to the price.
alter table public.reviews add column if not exists includes text
  check (includes is null or char_length(includes) <= 200);
grant select (includes) on public.reviews to anon;
