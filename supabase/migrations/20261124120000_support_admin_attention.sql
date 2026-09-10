-- @mentions on internal notes + per-admin read cursors for attention badges.

alter table public.support_ticket_internal_notes
  add column if not exists mentioned_user_ids uuid[] not null default '{}';

create index if not exists support_ticket_internal_notes_mentioned_gin
  on public.support_ticket_internal_notes using gin (mentioned_user_ids);

create table if not exists public.support_admin_ticket_reads (
  admin_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid not null references public.community_feedback_reports(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (admin_id, report_id)
);

create index if not exists support_admin_ticket_reads_admin_idx
  on public.support_admin_ticket_reads (admin_id, last_read_at desc);

alter table public.support_admin_ticket_reads enable row level security;

drop policy if exists "Admins manage own support ticket reads"
  on public.support_admin_ticket_reads;
create policy "Admins manage own support ticket reads"
  on public.support_admin_ticket_reads
  for all
  to authenticated
  using (
    admin_id = auth.uid()
    and public.is_admin()
  )
  with check (
    admin_id = auth.uid()
    and public.is_admin()
  );

-- Per-ticket attention for the signed-in admin.
-- open_assigned: assigned to me, status open, unread since last read (or never read).
-- mention: someone else @mentioned me in an internal note since last read.
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
    left join my_reads rd on rd.report_id = t.id
    where t.assigned_to = uid
      and t.status = 'open'
      and (rd.last_read_at is null or t.updated_at > rd.last_read_at)
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

create or replace function public.admin_support_attention_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint from public.admin_support_attention();
$$;

create or replace function public.mark_admin_support_ticket_read(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null or not public.is_admin() then
    return;
  end if;

  if not exists (
    select 1 from public.community_feedback_reports t where t.id = p_report_id
  ) then
    return;
  end if;

  insert into public.support_admin_ticket_reads (admin_id, report_id, last_read_at)
  values (auth.uid(), p_report_id, now())
  on conflict (admin_id, report_id)
  do update set last_read_at = excluded.last_read_at;
end;
$fn$;

revoke all on function public.admin_support_attention() from public;
revoke all on function public.admin_support_attention_count() from public;
revoke all on function public.mark_admin_support_ticket_read(uuid) from public;
grant execute on function public.admin_support_attention() to authenticated;
grant execute on function public.admin_support_attention_count() to authenticated;
grant execute on function public.mark_admin_support_ticket_read(uuid) to authenticated;
