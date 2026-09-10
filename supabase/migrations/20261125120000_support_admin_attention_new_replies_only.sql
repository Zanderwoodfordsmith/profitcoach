-- Attention badge for assigned tickets: only after the admin has opened the
-- ticket at least once, and only when someone else has replied since then.
-- Never-opened assigned tickets no longer show a "1".

create or replace function public.admin_support_attention()
returns table (
  report_id uuid,
  open_assigned boolean,
  mention boolean
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.is_admin() then
    return;
  end if;

  return query
  with my_reads as (
    select r.report_id, r.last_read_at
    from public.support_admin_ticket_reads r
    where r.admin_id = uid
  ),
  assigned as (
    select
      t.id as report_id,
      true as open_assigned,
      false as mention
    from public.community_feedback_reports t
    inner join my_reads rd on rd.report_id = t.id
    where t.assigned_to = uid
      and t.status = 'open'
      and exists (
        select 1
        from public.community_feedback_replies r
        where r.report_id = t.id
          and r.created_by <> uid
          and r.created_at > rd.last_read_at
      )
  ),
  mentioned as (
    select distinct
      n.report_id,
      false as open_assigned,
      true as mention
    from public.support_ticket_internal_notes n
    left join my_reads rd on rd.report_id = n.report_id
    where uid = any (n.mentioned_user_ids)
      and n.created_by <> uid
      and (rd.last_read_at is null or n.created_at > rd.last_read_at)
  )
  select
    x.report_id,
    bool_or(x.open_assigned) as open_assigned,
    bool_or(x.mention) as mention
  from (
    select * from assigned
    union all
    select * from mentioned
  ) x
  group by x.report_id;
end;
$fn$;
