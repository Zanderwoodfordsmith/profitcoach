-- Ticket owners can close or remove their own tickets.
-- Admins viewing as a member are not the owner, so these do nothing for them.

create or replace function public.member_set_support_ticket_status(
  p_report_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_status is distinct from 'open' and p_status is distinct from 'resolved' then
    raise exception 'Status must be open or resolved';
  end if;

  update public.community_feedback_reports
  set status = p_status
  where id = p_report_id
    and created_by = auth.uid();

  if not found then
    raise exception 'Ticket not found';
  end if;
end;
$fn$;

create or replace function public.member_delete_support_ticket(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  delete from public.community_feedback_reports
  where id = p_report_id
    and created_by = auth.uid();

  if not found then
    raise exception 'Ticket not found';
  end if;
end;
$fn$;

revoke all on function public.member_set_support_ticket_status(uuid, text) from public;
revoke all on function public.member_delete_support_ticket(uuid) from public;
grant execute on function public.member_set_support_ticket_status(uuid, text) to authenticated;
grant execute on function public.member_delete_support_ticket(uuid) to authenticated;
