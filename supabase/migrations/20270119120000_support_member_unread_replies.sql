-- Member unread badge counts staff replies, including on resolved tickets,
-- until that member opens the thread. Admins previewing as a coach must not
-- clear the member's read watermark. Admins may pass a coach id to read
-- that member's unread total for the sidebar.

drop function if exists public.coach_unread_support_reply_count();

create or replace function public.coach_unread_support_reply_count(
  p_coach_id uuid default null
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  target uuid := coalesce(p_coach_id, auth.uid());
begin
  if target is null then
    return 0;
  end if;

  if target is distinct from auth.uid() then
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    ) then
      return 0;
    end if;
  end if;

  return (
    select count(r.id)::bigint
    from public.community_feedback_reports t
    inner join public.community_feedback_replies r on r.report_id = t.id
    where t.created_by = target
      and r.created_by is distinct from target
      and (
        t.coach_last_read_at is null
        or r.created_at > t.coach_last_read_at
      )
  );
end;
$fn$;

revoke all on function public.coach_unread_support_reply_count(uuid) from public;
grant execute on function public.coach_unread_support_reply_count(uuid) to authenticated;

-- Only the ticket owner marks the thread read. An admin opening it while
-- viewing as that member leaves the notification in place.
create or replace function public.mark_support_ticket_read(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.community_feedback_reports
  set
    coach_last_read_at = now(),
    email_notify_after = null,
    email_notify_last_sent_at = now()
  where id = p_report_id
    and created_by = auth.uid();
end;
$fn$;
