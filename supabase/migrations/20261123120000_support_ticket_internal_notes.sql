-- Staff-only internal notes on support tickets (not visible to coaches).
-- Separate from community_feedback_replies so member RLS cannot leak notes.

create table if not exists public.support_ticket_internal_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  report_id uuid not null references public.community_feedback_reports(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  constraint support_ticket_internal_notes_body_nonempty
    check (char_length(trim(body)) > 0),
  constraint support_ticket_internal_notes_body_max
    check (char_length(body) <= 10000)
);

create index if not exists support_ticket_internal_notes_report_created_idx
  on public.support_ticket_internal_notes (report_id, created_at asc);

alter table public.support_ticket_internal_notes enable row level security;

drop policy if exists "Admins read support ticket internal notes"
  on public.support_ticket_internal_notes;
create policy "Admins read support ticket internal notes"
  on public.support_ticket_internal_notes
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins insert support ticket internal notes"
  on public.support_ticket_internal_notes;
create policy "Admins insert support ticket internal notes"
  on public.support_ticket_internal_notes
  for insert
  to authenticated
  with check (
    public.is_admin()
    and created_by = auth.uid()
  );

drop policy if exists "Admins delete support ticket internal notes"
  on public.support_ticket_internal_notes;
create policy "Admins delete support ticket internal notes"
  on public.support_ticket_internal_notes
  for delete
  to authenticated
  using (public.is_admin());
