-- Title column (safe if 20260731120000 was never applied: creates table first).
create table if not exists public.academy_lesson_content (
  course_id text not null,
  lesson_id text not null,
  title text,
  video_url text,
  body_markdown text,
  updated_at timestamptz not null default now(),
  primary key (course_id, lesson_id)
);

alter table public.academy_lesson_content
  add column if not exists title text;

comment on table public.academy_lesson_content is 'Admin-editable overrides for academy lessons; merged over catalog.json / legacy-hub.json';
comment on column public.academy_lesson_content.title is 'Optional display title override for the lesson';

-- Video uploads (no-op if 20260731120000 already ran).
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
