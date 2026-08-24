-- Roadmap jobs: internal build tracker managed by admins (UI + AI panel tools),
-- with a visibility flag so member-visible jobs can power a public product
-- roadmap later without a schema change.

create table if not exists public.roadmap_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  -- Free-text area/grouping, e.g. beat1, beat2, website, ai-panel, q4, parked
  area text not null default 'general',
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'done', 'blocked', 'parked')),
  blocked_by text,
  -- App route this job relates to, e.g. /admin/linkedin (lets the AI panel
  -- attach jobs to the screen the admin is looking at).
  app_path text,
  visibility text not null default 'internal'
    check (visibility in ('internal', 'members')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roadmap_jobs enable row level security;

drop policy if exists "roadmap_jobs_admin_all" on public.roadmap_jobs;
create policy "roadmap_jobs_admin_all" on public.roadmap_jobs
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Signed-in members can read member-visible jobs (future public roadmap page).
drop policy if exists "roadmap_jobs_member_read" on public.roadmap_jobs;
create policy "roadmap_jobs_member_read" on public.roadmap_jobs
  for select
  using (visibility = 'members' and auth.uid() is not null);

create index if not exists roadmap_jobs_area_idx on public.roadmap_jobs (area);
create index if not exists roadmap_jobs_status_idx on public.roadmap_jobs (status);
