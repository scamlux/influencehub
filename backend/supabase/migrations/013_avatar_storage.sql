-- Avatar storage
-- Bloggers' social profile pictures are fetched server-side and cached here so
-- they load reliably (no expiring/hot-link-blocked Instagram CDN URLs on the
-- client). Written by the `cache-avatars` edge function (service role); read by
-- anyone. See functions/cache-avatars/index.ts.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read for cached avatars. Writes go through the service role, which
-- bypasses RLS, so no insert/update policy is needed here.
drop policy if exists "Public avatar read" on storage.objects;
create policy "Public avatar read"
  on storage.objects for select
  using (bucket_id = 'avatars');
