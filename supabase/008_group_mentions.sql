-- Run after 007 (safe to run more than once).
-- "Seen this garage recommended in a group? Tell us" (spec 12.7): signed-in, one per account per garage,
-- group name only. Pending until you set status = 'approved' in the table editor.
create table if not exists public.group_mentions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  garage_slug text not null check (char_length(garage_slug) <= 120),
  group_name  text not null check (char_length(group_name) between 3 and 120),
  group_type  text not null default 'facebook' check (group_type in ('facebook', 'whatsapp', 'other')),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  unique (user_id, garage_slug)
);
alter table public.group_mentions enable row level security;
drop policy if exists "insert own mention" on public.group_mentions;
create policy "insert own mention" on public.group_mentions for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');
grant insert on public.group_mentions to authenticated;
