-- Roadmap: a Review status between in_progress and done (built, waiting for
-- Zander to check it), and a free-text project label that groups jobs under
-- one piece of work (Blueprint, Ava, Scripts & BOSS Review...).

alter table public.roadmap_jobs
  drop constraint if exists roadmap_jobs_status_check;

alter table public.roadmap_jobs
  add constraint roadmap_jobs_status_check
  check (
    status in ('todo', 'up_next', 'in_progress', 'review', 'done', 'live', 'parked')
  );

alter table public.roadmap_jobs
  add column if not exists project text;

create index if not exists roadmap_jobs_project_idx
  on public.roadmap_jobs (project);
