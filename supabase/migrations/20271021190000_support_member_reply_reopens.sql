-- When the ticket's member replies, put a waiting or resolved ticket back to open.
-- The app's own status update runs as the member, and RLS only lets admins
-- update tickets, so in-app replies left tickets in "Waiting on member".
-- Email replies already reopen on the server; this covers every path.

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
    and status in ('waiting_reply', 'resolved');
  return new;
end;
$fn$;

drop trigger if exists community_feedback_replies_reopen_trg
  on public.community_feedback_replies;
create trigger community_feedback_replies_reopen_trg
after insert on public.community_feedback_replies
for each row
execute procedure public.reopen_support_ticket_on_member_reply();

-- Ticket 550 (Peter): member replied in the app on 14 Oct and stayed waiting.
update public.community_feedback_reports
set status = 'open'
where ticket_number = 550
  and status = 'waiting_reply';
