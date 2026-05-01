-- Coach profile fields (first/last name, bio, location)
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists location text;

-- Avatars bucket for coach profile photos (public read; upload restricted by policy)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Allow authenticated users to upload to their own path: {user_id}/avatar (or avatar.jpg)
create policy "Users can upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read (bucket is public)
create policy "Avatar images are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- Allow users to update/delete their own avatar
create policy "Users can update own avatar"
on storage.objects for update
to authenticated
using ((storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own avatar"
on storage.objects for delete
to authenticated
using ((storage.foldername(name))[1] = auth.uid()::text);
