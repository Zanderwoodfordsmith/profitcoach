-- Skip specific recurring occurrences without showing them as cancelled.

alter table public.community_calendar_event_exceptions
  add column if not exists omit_from_calendar boolean not null default false;

-- May 2026 New Member Kick-off: no call (BCA Conference month) — omit, not cancel.
update public.community_calendar_event_exceptions
set
  omit_from_calendar = true,
  cancelled_at = null,
  cancellation_reason = null,
  rescheduled_starts_at = null,
  rescheduled_ends_at = null
where event_id = 'b0eef000-0000-4000-a000-000000000001'::uuid
  and occurrence_start = '2026-05-05T12:00:00+00'::timestamptz;

insert into public.community_calendar_event_exceptions (
  event_id,
  occurrence_start,
  omit_from_calendar
)
select
  'b0eef000-0000-4000-a000-000000000001'::uuid,
  '2026-05-05T12:00:00+00'::timestamptz,
  true
where exists (
  select 1
  from public.community_calendar_events
  where id = 'b0eef000-0000-4000-a000-000000000001'::uuid
)
on conflict (event_id, occurrence_start) do update
set
  omit_from_calendar = true,
  cancelled_at = null,
  cancellation_reason = null,
  rescheduled_starts_at = null,
  rescheduled_ends_at = null;
