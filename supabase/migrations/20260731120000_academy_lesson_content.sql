-- Editable classroom lesson content (video + markdown body). course_id/lesson_id match catalog.json.
create table if not exists public.academy_lesson_content (
  course_id text not null,
  lesson_id text not null,
  title text,
  video_url text,
  body_markdown text,
  updated_at timestamptz not null default now(),
  primary key (course_id, lesson_id)
);

comment on table public.academy_lesson_content is 'Admin-editable overrides for academy classroom lessons; merged over catalog.json';

-- Public read bucket for lesson videos (YouTube/Vimeo URLs stay in video_url; uploads go here).
insert into storage.buckets (id, name, public)
values ('academy-lessons', 'academy-lessons', true)
on conflict (id) do update set public = true;

drop policy if exists "Admins can upload academy lesson videos" on storage.objects;
create policy "Admins can upload academy lesson videos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'academy-lessons'
  and public.is_admin()
);

drop policy if exists "Academy lesson videos publicly readable" on storage.objects;
create policy "Academy lesson videos publicly readable"
on storage.objects for select
to public
using (bucket_id = 'academy-lessons');

drop policy if exists "Admins can update academy lesson videos" on storage.objects;
create policy "Admins can update academy lesson videos"
on storage.objects for update
to authenticated
using (bucket_id = 'academy-lessons' and public.is_admin());

drop policy if exists "Admins can delete academy lesson videos" on storage.objects;
create policy "Admins can delete academy lesson videos"
on storage.objects for delete
to authenticated
using (bucket_id = 'academy-lessons' and public.is_admin());
