alter table public.community_calendar_event_exceptions
  add column if not exists cancellation_reason text
  check (cancellation_reason is null or char_length(cancellation_reason) <= 500);

drop policy if exists "Admin update community_calendar_event_exceptions" on public.community_calendar_event_exceptions;
create policy "Admin update community_calendar_event_exceptions"
  on public.community_calendar_event_exceptions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
