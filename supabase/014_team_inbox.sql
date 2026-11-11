-- Run after 013 (safe to run more than once).
-- team_inbox(days): everything visitors send us that someone on the team must read or act on, in one call.
-- Readable with the site's public key, so it returns NO personal data: never an email, phone, WhatsApp number,
-- display name, account id, review text, or the free-text "details" of a suggestion or report.

-- Free text can hold contact details a visitor typed by mistake: strip anything that looks like an email
-- or a phone number (7+ digits, spaces and dashes allowed) and cut to 200 characters.
create or replace function public.redact_pii(t text) returns text
language sql immutable set search_path = public as $$
  select left(regexp_replace(regexp_replace(t, '[^[:space:]@]+@[^[:space:]@]+', '[removed]', 'g'),
                             '\+?[0-9]([ ().-]*[0-9]){6,}', '[removed]', 'g'), 200);
$$;
revoke all on function public.redact_pii(text) from public;

create or replace function public.team_inbox(days int default 14)
returns table (source text, created_at timestamptz, subject text, status text, content jsonb)
language sql stable security definer set search_path = public as $$
  with w as (select now() - make_interval(days => least(greatest(days, 1), 365)) as since)
  select * from (
    -- Add a garage / suggest a correction
    select 'garage_suggestion' as source, s.created_at, coalesce(s.garage_slug, redact_pii(s.name)) as subject, 'unread' as status,
           jsonb_build_object('kind', case s.kind when 'new' then 'add' else 'correction' end, 'name', redact_pii(s.name),
             'area', redact_pii(s.area), 'cars', redact_pii(s.cars), 'is_owner', s.is_owner, 'has_contact', s.contact is not null) as content
    from garage_suggestions s, w where s.created_at >= w.since
    union all
    -- Report this review
    select 'report', r.created_at, coalesce(v.garage_slug, r.page), r.status,
           jsonb_build_object('reason', r.reason, 'reporter_type', r.reporter_type, 'page', r.page, 'has_contact', r.contact is not null)
    from reports r left join reviews v on v.id = r.review_id, w where r.created_at >= w.since
    union all
    -- "Did this help?" answers: every "no", and any answer with a note. Also the search box "Tell us what's wrong".
    select case when f.ref = 'problem-demand' then 'problem_search' else 'feedback' end, f.created_at, f.page, 'unread',
           jsonb_build_object('helped', f.helped, 'note', redact_pii(f.note))
    from feedback f, w where f.created_at >= w.since and (f.helped = false or f.note is not null)
    union all
    -- Owner reviews: pending ones need approving before they show. No name, no text.
    select 'review', v.created_at, v.garage_slug, v.status,
           jsonb_build_object('car', concat_ws(' ', v.car_year::text, v.car_make, v.car_model), 'rating', v.rating, 'job', redact_pii(v.job),
             'price_paid', v.price_paid, 'dealer_quote', v.dealer_quote, 'chars', char_length(v.body), 'has_photo', v.photo_path is not null)
    from reviews v, w where v.created_at >= w.since
    union all
    -- "Seen this garage recommended in a group?"
    select 'group_mention', g.created_at, g.garage_slug, g.status, jsonb_build_object('group_type', g.group_type, 'group_name', redact_pii(g.group_name))
    from group_mentions g, w where g.created_at >= w.since
    union all
    -- Quote checks: pending until approved
    select 'quote_check', q.created_at, concat_ws(' ', q.make, q.model), q.status,
           jsonb_build_object('job', q.job, 'job_note', redact_pii(q.job_note), 'aed', q.aed, 'side', q.side, 'month', q.month)
    from quote_checks q, w where q.created_at >= w.since
    union all
    -- "Tell me when my car is covered": the car only, never the email
    select 'coverage_request', c.created_at, redact_pii(c.car), 'waiting', jsonb_build_object('page', c.page)
    from coverage_requests c, w where c.created_at >= w.since
    union all
    -- Uncovered cars people looked for: top 30, counted
    select 'car_demand', d.last_seen, d.car, 'count', jsonb_build_object('searches', d.n)
    from (select concat_ws(' ', make, model) as car, count(*) as n, max(created_at) as last_seen
          from car_demand, w where created_at >= w.since group by 1 order by 2 desc limit 30) d
  ) x order by x.created_at desc limit 500;
$$;
revoke all on function public.team_inbox(int) from public;
grant execute on function public.team_inbox(int) to anon, authenticated;
