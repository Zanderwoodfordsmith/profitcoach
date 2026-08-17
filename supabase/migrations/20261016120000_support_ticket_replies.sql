-- Support tickets: ticket numbers, creator read access, and threaded replies.

-- Human-readable ticket numbers (SUP-0410 style in the UI).
create sequence if not exists public.community_feedback_ticket_number_seq
  as bigint
  start with 400
  increment by 1
  owned by none;

alter table public.community_feedback_reports
  add column if not exists ticket_number bigint;

do $$
declare
  rec record;
begin
  for rec in
    select id
    from public.community_feedback_reports
    where ticket_number is null
    order by created_at asc, id asc
  loop
    update public.community_feedback_reports
    set ticket_number = nextval('public.community_feedback_ticket_number_seq')
    where id = rec.id;
  end loop;
end $$;

alter table public.community_feedback_reports
  alter column ticket_number set default nextval('public.community_feedback_ticket_number_seq');

alter table public.community_feedback_reports
  alter column ticket_number set not null;

create unique index if not exists community_feedback_reports_ticket_number_uidx
  on public.community_feedback_reports (ticket_number);

-- Submitters can read their own tickets (admin select policy already exists).
drop policy if exists "Creators read own community feedback reports"
  on public.community_feedback_reports;
create policy "Creators read own community feedback reports"
  on public.community_feedback_reports for select
  to authenticated
  using (created_by = auth.uid());

-- Conversation replies on a ticket.
create table if not exists public.community_feedback_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  report_id uuid not null references public.community_feedback_reports(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  constraint community_feedback_replies_body_nonempty
    check (char_length(trim(body)) > 0)
);

create index if not exists community_feedback_replies_report_created_idx
  on public.community_feedback_replies (report_id, created_at asc);

alter table public.community_feedback_replies enable row level security;

drop policy if exists "Ticket participants read feedback replies"
  on public.community_feedback_replies;
create policy "Ticket participants read feedback replies"
  on public.community_feedback_replies for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
    or exists (
      select 1 from public.community_feedback_reports r
      where r.id = report_id
        and r.created_by = auth.uid()
    )
  );

drop policy if exists "Ticket participants insert feedback replies"
  on public.community_feedback_replies;
create policy "Ticket participants insert feedback replies"
  on public.community_feedback_replies for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
      or exists (
        select 1 from public.community_feedback_reports r
        where r.id = report_id
          and r.created_by = auth.uid()
      )
    )
  );

drop policy if exists "Admins delete feedback replies"
  on public.community_feedback_replies;
create policy "Admins delete feedback replies"
  on public.community_feedback_replies for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
