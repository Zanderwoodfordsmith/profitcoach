-- Ava's prospect searches for BCA to check (16 Nov): her thinking and the
-- Sales Navigator lists she would build, waiting for "Import it".

alter table public.launch_job_activity
  drop constraint if exists launch_job_activity_kind_check;

alter table public.launch_job_activity
  add constraint launch_job_activity_kind_check
  check (kind in ('note', 'ava', 'draft', 'message', 'answers', 'event', 'searches'));
