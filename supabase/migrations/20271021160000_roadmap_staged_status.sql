-- Roadmap: "done" now shows as Ready (checked, waiting for stage), and a
-- staged status for jobs on staging.theprofitcoach.com waiting to go live.

alter table public.roadmap_jobs
  drop constraint if exists roadmap_jobs_status_check;

alter table public.roadmap_jobs
  add constraint roadmap_jobs_status_check
  check (
    status in (
      'todo', 'up_next', 'in_progress', 'review', 'done', 'staged', 'live',
      'evaluate', 'parked', 'vetoed'
    )
  );
