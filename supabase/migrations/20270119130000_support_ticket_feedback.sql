-- One helpful / not-yet vote per member per ticket, tied to the reply
-- they were looking at. Used later to judge which answers actually helped.

create table if not exists public.support_ticket_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report_id uuid not null references public.community_feedback_reports(id) on delete cascade,
  reply_id uuid references public.community_feedback_replies(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  helpful boolean not null,
  comment text,
  constraint support_ticket_feedback_one_per_member
    unique (report_id, created_by),
  constraint support_ticket_feedback_comment_max
    check (comment is null or char_length(comment) <= 2000)
);

create index if not exists support_ticket_feedback_report_idx
  on public.support_ticket_feedback (report_id);

alter table public.support_ticket_feedback enable row level security;

drop policy if exists "Read own or admin support ticket feedback"
  on public.support_ticket_feedback;
create policy "Read own or admin support ticket feedback"
  on public.support_ticket_feedback
  for select
  to authenticated
  using (created_by = auth.uid() or public.is_admin());

drop policy if exists "Members insert own support ticket feedback"
  on public.support_ticket_feedback;
create policy "Members insert own support ticket feedback"
  on public.support_ticket_feedback
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.community_feedback_reports t
      where t.id = report_id
        and t.created_by = auth.uid()
    )
  );

drop policy if exists "Members update own support ticket feedback"
  on public.support_ticket_feedback;
create policy "Members update own support ticket feedback"
  on public.support_ticket_feedback
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

grant select, insert, update on public.support_ticket_feedback to authenticated;
