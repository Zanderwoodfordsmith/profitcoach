-- Admin-confirmed Drive file → lesson mappings for academy import script.
create table if not exists public.academy_import_overrides (
  relative_path text primary key,
  course_id text not null,
  lesson_id text not null,
  lesson_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.academy_import_overrides is
  'Manual file-to-lesson links from admin Import tab; merged into import-academy-lessons-from-drive-folder.ts overrides.';

create index if not exists academy_import_overrides_lesson_idx
  on public.academy_import_overrides (course_id, lesson_id);

alter table public.academy_import_overrides enable row level security;

drop policy if exists "Admins read academy import overrides" on public.academy_import_overrides;
create policy "Admins read academy import overrides"
on public.academy_import_overrides for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins manage academy import overrides" on public.academy_import_overrides;
create policy "Admins manage academy import overrides"
on public.academy_import_overrides for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Service role manages academy import overrides" on public.academy_import_overrides;
create policy "Service role manages academy import overrides"
on public.academy_import_overrides for all
to service_role
using (true)
with check (true);
