-- Badge = unread reply count (coach follow-ups), not the initial ticket body.
-- Never-opened tickets with no replies stay unbadged; follow-up chats count.

drop function if exists public.admin_support_attention();

create or replace function public.admin_support_attention()
returns table (
  report_id uuid,
  unread_replies bigint,
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
  unread as (
    select
      t.id as report_id,
      count(r.id)::bigint as unread_replies,
      false as mention
    from public.community_feedback_reports t
    left join my_reads rd on rd.report_id = t.id
    inner join public.community_feedback_replies r on r.report_id = t.id
    where t.assigned_to = uid
      and t.status <> 'resolved'
      and r.created_by <> uid
      and (
        rd.last_read_at is null
        or r.created_at > rd.last_read_at
      )
    group by t.id
  ),
  mentioned as (
    select distinct
      n.report_id,
      0::bigint as unread_replies,
      true as mention
    from public.support_ticket_internal_notes n
    left join my_reads rd on rd.report_id = n.report_id
    where uid = any (n.mentioned_user_ids)
      and n.created_by <> uid
      and (rd.last_read_at is null or n.created_at > rd.last_read_at)
  )
  select
    x.report_id,
    coalesce(sum(x.unread_replies), 0)::bigint as unread_replies,
    bool_or(x.mention) as mention
  from (
    select * from unread
    union all
    select * from mentioned
  ) x
  group by x.report_id;
end;
$fn$;

create or replace function public.admin_support_attention_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint from public.admin_support_attention();
$$;

revoke all on function public.admin_support_attention() from public;
revoke all on function public.admin_support_attention_count() from public;
grant execute on function public.admin_support_attention() to authenticated;
grant execute on function public.admin_support_attention_count() to authenticated;
