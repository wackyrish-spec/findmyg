-- 016_team_act.sql (Wed batch). Lets the team mark a site-inbox row handled, with a note.
-- Callable with the site's public key, but only with the team passphrase. The passphrase is NOT in this file:
-- it is stored only as a bcrypt hash. Set or rotate it in the Supabase SQL editor with:
--   select public.set_team_passphrase('<passphrase>');
-- Safe to run more than once.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.team_actions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  source      text not null,          -- the team_inbox source, e.g. 'garage_suggestion', 'feedback', 'review'
  item_id     text not null,          -- the row id that team_inbox returns
  action      text not null check (action in ('handled','approved','rejected','dismissed')),
  note        text,
  unique (source, item_id)
);
alter table public.team_actions enable row level security;
revoke all on public.team_actions from anon, authenticated;

-- One row: the passphrase hash. No policies, so nobody reads it through the API.
create table if not exists public.team_secret (id int primary key default 1 check (id = 1), hash text not null, set_at timestamptz not null default now());
alter table public.team_secret enable row level security;
revoke all on public.team_secret from anon, authenticated;

create or replace function public.set_team_passphrase(p text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p is null or length(p) < 20 then raise exception 'passphrase must be 20+ characters'; end if;
  insert into team_secret (id, hash, set_at) values (1, crypt(p, gen_salt('bf', 10)), now())
  on conflict (id) do update set hash = excluded.hash, set_at = now();
  return 'passphrase set';
end $$;
revoke all on function public.set_team_passphrase(text) from public, anon, authenticated;

drop function if exists public.team_act(text, text, text, text);
create or replace function public.team_act(p_secret text, p_source text, p_id text, p_action text default 'handled', p_note text default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare h text; r json;
begin
  select hash into h from team_secret where id = 1;
  if h is null or p_secret is null or crypt(p_secret, h) <> h then
    perform pg_sleep(1);
    raise exception 'not allowed';
  end if;
  insert into team_actions (source, item_id, action, note)
  values (p_source, p_id, p_action, left(p_note, 500))
  on conflict (source, item_id) do update set action = excluded.action, note = excluded.note, created_at = now()
  returning json_build_object('source', source, 'id', item_id, 'action', action, 'at', created_at) into r;
  return r;
end $$;
revoke all on function public.team_act(text, text, text, text, text) from public;
grant execute on function public.team_act(text, text, text, text, text) to anon, authenticated;

-- team_inbox now returns item_id (pass it to team_act) and shows the team's action as the status, with its note.
-- The return type changes, so the old function is dropped first. It still returns no personal data.
drop function if exists public.team_inbox(int);
create or replace function public.team_inbox(days int default 14)
returns table (source text, item_id text, created_at timestamptz, subject text, status text, content jsonb, handled_note text)
language sql stable security definer set search_path = public as $$
  with w as (select now() - make_interval(days => least(greatest(days, 1), 365)) as since)
  select x.source, x.item_id, x.created_at, x.subject, coalesce(t.action, x.status), x.content, t.note from (
    -- Add a garage / suggest a correction
    select 'garage_suggestion' as source, s.id::text as item_id, s.created_at, coalesce(s.garage_slug, redact_pii(s.name)) as subject, 'unread' as status,
           jsonb_build_object('kind', case s.kind when 'new' then 'add' else 'correction' end, 'name', redact_pii(s.name),
             'area', redact_pii(s.area), 'cars', redact_pii(s.cars), 'is_owner', s.is_owner, 'has_contact', s.contact is not null) as content
    from garage_suggestions s, w where s.created_at >= w.since
    union all
    -- Report this review
    select 'report', r.id::text, r.created_at, coalesce(v.garage_slug, r.page), r.status,
           jsonb_build_object('reason', r.reason, 'reporter_type', r.reporter_type, 'page', r.page, 'has_contact', r.contact is not null)
    from reports r left join reviews v on v.id = r.review_id, w where r.created_at >= w.since
    union all
    -- "Did this help?" answers: every "no", and any answer with a note. Also the search box "Tell us what's wrong".
    select case when f.ref = 'problem-demand' then 'problem_search' else 'feedback' end, f.id::text, f.created_at, f.page, 'unread',
           jsonb_build_object('helped', f.helped, 'note', redact_pii(f.note))
    from feedback f, w where f.created_at >= w.since and (f.helped = false or f.note is not null)
    union all
    -- Owner reviews: pending ones need approving before they show. No name, no text.
    select 'review', v.id::text, v.created_at, v.garage_slug, v.status,
           jsonb_build_object('car', concat_ws(' ', v.car_year::text, v.car_make, v.car_model), 'rating', v.rating, 'job', redact_pii(v.job),
             'price_paid', v.price_paid, 'dealer_quote', v.dealer_quote, 'chars', char_length(v.body), 'has_photo', v.photo_path is not null)
    from reviews v, w where v.created_at >= w.since
    union all
    -- "Seen this garage recommended in a group?"
    select 'group_mention', g.id::text, g.created_at, g.garage_slug, g.status, jsonb_build_object('group_type', g.group_type, 'group_name', redact_pii(g.group_name))
    from group_mentions g, w where g.created_at >= w.since
    union all
    -- Quote checks: pending until approved
    select 'quote_check', q.id::text, q.created_at, concat_ws(' ', q.make, q.model), q.status,
           jsonb_build_object('job', q.job, 'job_note', redact_pii(q.job_note), 'aed', q.aed, 'side', q.side, 'month', q.month)
    from quote_checks q, w where q.created_at >= w.since
    union all
    -- "Tell me when my car is covered": the car only, never the email
    select 'coverage_request', c.id::text, c.created_at, redact_pii(c.car), 'waiting', jsonb_build_object('page', c.page)
    from coverage_requests c, w where c.created_at >= w.since
    union all
    -- Uncovered cars people looked for: top 30, counted
    select 'car_demand', d.car, d.last_seen, d.car, 'count', jsonb_build_object('searches', d.n)
    from (select concat_ws(' ', make, model) as car, count(*) as n, max(created_at) as last_seen
          from car_demand, w where created_at >= w.since group by 1 order by 2 desc limit 30) d
  ) x left join public.team_actions t on t.source = x.source and t.item_id = x.item_id
  order by x.created_at desc limit 500;
$$;
revoke all on function public.team_inbox(int) from public;
grant execute on function public.team_inbox(int) to anon, authenticated;
