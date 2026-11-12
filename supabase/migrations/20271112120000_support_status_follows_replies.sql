-- Support ticket status follows the conversation (Zander, 12 Nov):
--   coach starts a message           -> BCA to do (open, the default)
--   BCA replies                      -> Needs coach (waiting_reply)
--   coach replies, BCA has before    -> In progress
--   coach replies, BCA never has     -> stays / goes back to BCA to do
-- A status set by hand stands until the next message. Runs on every reply,
-- whichever way it came in (app, email, scheduled, Ava approved by BCA).
--
-- From the coach = written by the ticket's own coach, or arrived by email
-- (inbound email from a non-member is stored under a BCA author, so the
-- email ids are what mark it as theirs).

create or replace function public.support_ticket_status_on_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t record;
  bca_before boolean;
begin
  select id, created_by, created_by_admin, status
  into t
  from public.community_feedback_reports
  where id = new.report_id;
  if not found then
    return new;
  end if;

  if (t.created_by is not null and new.created_by = t.created_by)
     or new.unipile_email_id is not null
     or new.bird_message_id is not null then
    if t.status in ('waiting_reply', 'review', 'resolved') then
      select t.created_by_admin is not null or exists (
        select 1
        from public.community_feedback_replies r
        where r.report_id = t.id
          and r.id <> new.id
          and r.created_by is distinct from t.created_by
          and r.unipile_email_id is null
          and r.bird_message_id is null
      )
      into bca_before;

      update public.community_feedback_reports
      set status = case when bca_before then 'in_progress' else 'open' end
      where id = t.id;
    end if;
  elsif t.status is distinct from 'waiting_reply' then
    update public.community_feedback_reports
    set status = 'waiting_reply'
    where id = t.id;
  end if;

  return new;
end;
$fn$;

drop trigger if exists community_feedback_replies_reopen_trg
  on public.community_feedback_replies;
drop trigger if exists community_feedback_replies_status_trg
  on public.community_feedback_replies;
create trigger community_feedback_replies_status_trg
after insert on public.community_feedback_replies
for each row
execute procedure public.support_ticket_status_on_reply();
