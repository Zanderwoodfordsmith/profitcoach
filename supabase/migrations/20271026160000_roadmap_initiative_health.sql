-- Initiatives like Linear's: a status (Planned, Active, Completed), a target
-- (a quarter like 2026-Q4, or a year like 2027) and an owner (an admin).
-- Projects get updates marked on track, at risk or off track; the latest one
-- is the project's health. Additive only.

alter table public.roadmap_initiatives
  add column if not exists status text not null default 'active',
  add column if not exists target text,
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roadmap_initiatives_status_check') then
    alter table public.roadmap_initiatives
      add constraint roadmap_initiatives_status_check check (status in ('planned', 'active', 'completed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'roadmap_initiatives_target_check') then
    alter table public.roadmap_initiatives
      add constraint roadmap_initiatives_target_check check (target is null or target ~ '^\d{4}(-Q[1-4])?$');
  end if;
end $$;

create table if not exists public.roadmap_project_updates (
  id uuid primary key default gen_random_uuid(),
  -- The project's name (roadmap_projects.name; jobs carry it as text too).
  project text not null,
  health text not null,
  body text,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text,
  created_at timestamptz not null default now(),
  constraint roadmap_project_updates_health_check check (health in ('on_track', 'at_risk', 'off_track'))
);

create index if not exists roadmap_project_updates_project_idx
  on public.roadmap_project_updates (project, created_at desc);

alter table public.roadmap_project_updates enable row level security;
-- Admin API only.
