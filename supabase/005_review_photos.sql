-- Run after 004 (safe to run more than once).
-- Optional owner photo with a review. Photos are resized in the browser (which also strips
-- location data) and stored in a public bucket under the owner's own folder. The site only
-- shows a photo once you approve its review.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 3145728, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

drop policy if exists "owners upload review photos" on storage.objects;
create policy "owners upload review photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.reviews add column if not exists photo_path text
  check (photo_path is null or (char_length(photo_path) <= 120 and split_part(photo_path, '/', 1) = user_id::text));
grant select (photo_path) on public.reviews to anon;
