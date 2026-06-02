-- Public read bucket for images embedded in academy lesson bodies (screenshots,
-- diagrams). Markdown in academy_lesson_content.body_markdown references these by
-- public URL instead of inlining base64 (keeps the table small and pages fast).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-lesson-images',
  'academy-lesson-images',
  true,
  26214400, -- 25 MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload academy lesson images" on storage.objects;
create policy "Admins can upload academy lesson images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'academy-lesson-images'
  and public.is_admin()
);

drop policy if exists "Academy lesson images publicly readable" on storage.objects;
create policy "Academy lesson images publicly readable"
on storage.objects for select
to public
using (bucket_id = 'academy-lesson-images');

drop policy if exists "Admins can update academy lesson images" on storage.objects;
create policy "Admins can update academy lesson images"
on storage.objects for update
to authenticated
using (bucket_id = 'academy-lesson-images' and public.is_admin());

drop policy if exists "Admins can delete academy lesson images" on storage.objects;
create policy "Admins can delete academy lesson images"
on storage.objects for delete
to authenticated
using (bucket_id = 'academy-lesson-images' and public.is_admin());
