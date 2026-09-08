-- Three support ticket states: open · waiting_reply · resolved
-- Legacy: new / in_review → open

alter table public.community_feedback_reports
  drop constraint if exists community_feedback_reports_status_check;

update public.community_feedback_reports
set status = 'open'
where status in ('new', 'in_review', 'submitted', 'in_progress');

alter table public.community_feedback_reports
  alter column status set default 'open';

alter table public.community_feedback_reports
  add constraint community_feedback_reports_status_check
  check (status in ('open', 'waiting_reply', 'resolved'));
