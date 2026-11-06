-- Run after 003 (safe to run more than once).
-- Right of reply (legal/takedown-and-right-of-reply.md, Part B).

-- 1) "Report this review": anyone can file a report; nobody can read them except you in the dashboard.
create table if not exists public.reports (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  review_id     uuid references public.reviews (id) on delete set null,
  reporter_type text not null check (reporter_type in ('owner', 'garage', 'other')),
  reason        text not null check (reason in ('fake', 'abusive', 'private', 'wrong', 'other')),
  details       text check (char_length(details) <= 1000),
  contact       text check (char_length(contact) <= 200),
  page          text check (char_length(page) <= 200),
  status        text not null default 'open' check (status in ('open', 'hidden', 'kept', 'removed', 'edited')),
  decision_note text
);
alter table public.reports enable row level security;
drop policy if exists "insert report" on public.reports;
create policy "insert report" on public.reports for insert to anon, authenticated
  with check (status = 'open' and decision_note is null);
grant insert (review_id, reporter_type, reason, details, contact, page) on public.reports to anon, authenticated;

-- 2) "Reply from [garage]": you paste the garage's moderated reply into these two columns in the table editor.
alter table public.reviews add column if not exists garage_reply text
  check (garage_reply is null or char_length(garage_reply) <= 1000);
alter table public.reviews add column if not exists garage_reply_at timestamptz;
grant select (garage_reply, garage_reply_at) on public.reviews to anon;

-- Reviewers can't write the garage's reply into their own review.
create or replace function public.reviews_no_self_reply() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.garage_reply := null;
    new.garage_reply_at := null;
  end if;
  return new;
end $$;
drop trigger if exists reviews_no_self_reply on public.reviews;
create trigger reviews_no_self_reply before insert on public.reviews
  for each row execute function public.reviews_no_self_reply();
