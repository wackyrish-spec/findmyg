-- Run after 008 (safe to run more than once). Spec 13.5: "This is my garage" tick.
alter table public.garage_suggestions add column if not exists is_owner boolean not null default false;
