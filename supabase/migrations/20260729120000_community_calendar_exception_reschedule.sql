-- Per-occurrence reschedule for recurring community calendar events

alter table public.community_calendar_event_exceptions
  add column if not exists rescheduled_starts_at timestamptz,
  add column if not exists rescheduled_ends_at timestamptz;

alter table public.community_calendar_event_exceptions
  drop constraint if exists community_calendar_event_exceptions_reschedule_pair;

alter table public.community_calendar_event_exceptions
  add constraint community_calendar_event_exceptions_reschedule_pair
  check (
    (rescheduled_starts_at is null and rescheduled_ends_at is null)
    or (
      rescheduled_starts_at is not null
      and rescheduled_ends_at is not null
      and rescheduled_ends_at > rescheduled_starts_at
    )
  );
