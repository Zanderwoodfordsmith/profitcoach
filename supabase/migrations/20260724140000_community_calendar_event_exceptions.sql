-- Cancel individual occurrences of recurring community calendar events

create table if not exists public.community_calendar_event_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.community_calendar_events (id) on delete cascade,
  occurrence_start timestamptz not null,
  created_at timestamptz not null default now(),
  constraint community_calendar_event_exceptions_unique unique (event_id, occurrence_start)
);

create index if not exists community_calendar_event_exceptions_event_id_idx
  on public.community_calendar_event_exceptions (event_id);

alter table public.community_calendar_event_exceptions enable row level security;

drop policy if exists "Staff read community_calendar_event_exceptions" on public.community_calendar_event_exceptions;
create policy "Staff read community_calendar_event_exceptions"
  on public.community_calendar_event_exceptions for select
  to authenticated
  using (public.is_staff_community());

drop policy if exists "Admin insert community_calendar_event_exceptions" on public.community_calendar_event_exceptions;
create policy "Admin insert community_calendar_event_exceptions"
  on public.community_calendar_event_exceptions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin delete community_calendar_event_exceptions" on public.community_calendar_event_exceptions;
create policy "Admin delete community_calendar_event_exceptions"
  on public.community_calendar_event_exceptions for delete
  to authenticated
  using (public.is_admin());
