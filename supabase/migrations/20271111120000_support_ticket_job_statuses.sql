-- Support tickets marked like the launch jobs (11 Nov):
-- open = BCA to do, in_progress = In progress, waiting_reply = Needs coach,
-- review = Review, resolved = Done. Adds in_progress and review.

alter table public.community_feedback_reports
  drop constraint if exists community_feedback_reports_status_check;

alter table public.community_feedback_reports
  add constraint community_feedback_reports_status_check
  check (status in ('open', 'in_progress', 'waiting_reply', 'review', 'resolved'));

-- A coach reply on a ticket waiting for them to check puts it back with BCA too.
create or replace function public.reopen_support_ticket_on_member_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.community_feedback_reports
  set status = 'open'
  where id = new.report_id
    and created_by = new.created_by
    and status in ('waiting_reply', 'review', 'resolved');
  return new;
end;
$fn$;
