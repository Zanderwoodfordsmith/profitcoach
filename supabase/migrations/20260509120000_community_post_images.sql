-- Optional image attachment per community post + public storage bucket

alter table public.community_posts
  add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('community-posts', 'community-posts', true)
on conflict (id) do update set public = true;

drop policy if exists "Staff can upload own community post images" on storage.objects;
create policy "Staff can upload own community post images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-posts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Community post images publicly readable" on storage.objects;
create policy "Community post images publicly readable"
on storage.objects for select
to public
using (bucket_id = 'community-posts');

drop policy if exists "Staff can update own community post images" on storage.objects;
create policy "Staff can update own community post images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'community-posts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Staff can delete own community post images" on storage.objects;
create policy "Staff can delete own community post images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-posts'
  and (storage.foldername(name))[1] = auth.uid()::text
);
