-- Support dashboard (job 237): when each ticket was closed, and a plain topic
-- the AI picked for it. Both additive.

alter table public.community_feedback_reports
  add column if not exists resolved_at timestamptz,
  add column if not exists ai_topic text;

-- Tagging a topic or filling a closed time is not activity on the ticket:
-- leave updated_at alone when nothing else changed.
create or replace function public.set_community_feedback_reports_updated_at()
returns trigger
language plpgsql
as $function$
begin
  if (to_jsonb(new) - 'ai_topic' - 'resolved_at' - 'updated_at')
     = (to_jsonb(old) - 'ai_topic' - 'resolved_at' - 'updated_at') then
    new.updated_at = old.updated_at;
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$function$;

-- Closed time follows the status: set when a ticket becomes Done, cleared if
-- it is opened again (it gets a new time when it is closed again).
create or replace function public.set_support_ticket_resolved_at()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.status = 'resolved' and (tg_op = 'INSERT' or old.status is distinct from 'resolved') then
    new.resolved_at := coalesce(new.resolved_at, now());
  elsif new.status <> 'resolved' then
    new.resolved_at := null;
  end if;
  return new;
end;
$fn$;

drop trigger if exists community_feedback_reports_resolved_at_trg
  on public.community_feedback_reports;
create trigger community_feedback_reports_resolved_at_trg
  before insert or update of status on public.community_feedback_reports
  for each row execute function public.set_support_ticket_resolved_at();

-- Past tickets: no closed time was kept, so use the last message on the
-- ticket. Tickets closed with no messages stay blank (left out of close times).
update public.community_feedback_reports r
set resolved_at = last_reply.at
from (
  select report_id, max(created_at) as at
  from public.community_feedback_replies
  group by report_id
) last_reply
where last_reply.report_id = r.id
  and r.status = 'resolved'
  and r.resolved_at is null;

create index if not exists community_feedback_reports_created_at_idx
  on public.community_feedback_reports (created_at desc);
