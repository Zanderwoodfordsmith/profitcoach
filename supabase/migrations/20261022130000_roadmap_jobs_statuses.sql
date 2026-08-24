-- Roadmap statuses v2: rename doing -> in_progress, add up_next and live
-- (done = built & verified; live = released to coaches/members).

alter table public.roadmap_jobs
  drop constraint if exists roadmap_jobs_status_check;

update public.roadmap_jobs set status = 'in_progress' where status = 'doing';

alter table public.roadmap_jobs
  add constraint roadmap_jobs_status_check
  check (
    status in (
      'todo',
      'up_next',
      'in_progress',
      'done',
      'live',
      'blocked',
      'parked'
    )
  );
