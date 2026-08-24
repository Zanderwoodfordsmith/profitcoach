-- Blocked becomes a flag (blocked_by set), not a status. Jobs previously in
-- the blocked status return to todo and keep their blocked_by reason.

alter table public.roadmap_jobs
  drop constraint if exists roadmap_jobs_status_check;

update public.roadmap_jobs set status = 'todo' where status = 'blocked';

alter table public.roadmap_jobs
  add constraint roadmap_jobs_status_check
  check (
    status in ('todo', 'up_next', 'in_progress', 'done', 'live', 'parked')
  );
