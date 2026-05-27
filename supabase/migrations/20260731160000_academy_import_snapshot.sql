-- Latest academy Drive import report (unmatched / ambiguous / errors) for admin UI.
create table if not exists public.academy_import_snapshot (
  id int primary key default 1 check (id = 1),
  report jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.academy_import_snapshot is
  'Single-row JSON report from import-academy-lessons-from-drive-folder.ts (admin import status page).';

alter table public.academy_import_snapshot enable row level security;

drop policy if exists "Admins can read academy import snapshot" on public.academy_import_snapshot;
create policy "Admins can read academy import snapshot"
on public.academy_import_snapshot for select
to authenticated
using (public.is_admin());

drop policy if exists "Service role manages academy import snapshot" on public.academy_import_snapshot;
create policy "Service role manages academy import snapshot"
on public.academy_import_snapshot for all
to service_role
using (true)
with check (true);
