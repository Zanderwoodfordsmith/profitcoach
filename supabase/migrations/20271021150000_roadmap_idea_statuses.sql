-- Roadmap: the Parked column becomes Ideas, with three statuses.
--   evaluate  a new idea, saved with a description, not scored or decided yet
--   parked    a good idea for one day, not now
--   vetoed    decided against for now, kept as a log of what we said no to

alter table public.roadmap_jobs
  drop constraint if exists roadmap_jobs_status_check;

alter table public.roadmap_jobs
  add constraint roadmap_jobs_status_check
  check (
    status in (
      'todo', 'up_next', 'in_progress', 'review', 'done', 'live',
      'evaluate', 'parked', 'vetoed'
    )
  );
