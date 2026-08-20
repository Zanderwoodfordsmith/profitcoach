-- Coach unread support replies: last-read timestamp + count/mark helpers.

alter table public.community_feedback_reports
  add column if not exists coach_last_read_at timestamptz;

create or replace function public.coach_unread_support_reply_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct t.id)::bigint
  from public.community_feedback_reports t
  inner join public.community_feedback_replies r on r.report_id = t.id
  where t.created_by = auth.uid()
    and r.created_by <> auth.uid()
    and (
      t.coach_last_read_at is null
      or r.created_at > t.coach_last_read_at
    );
$$;

create or replace function public.mark_support_ticket_read(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.community_feedback_reports
  set coach_last_read_at = now()
  where id = p_report_id
    and created_by = auth.uid();
end;
$fn$;

revoke all on function public.coach_unread_support_reply_count() from public;
revoke all on function public.mark_support_ticket_read(uuid) from public;
grant execute on function public.coach_unread_support_reply_count() to authenticated;
grant execute on function public.mark_support_ticket_read(uuid) to authenticated;
