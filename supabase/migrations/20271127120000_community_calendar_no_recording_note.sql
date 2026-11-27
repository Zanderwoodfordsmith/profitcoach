-- A note coaches see on a past session that has no recording
-- (e.g. "Sorry, we forgot to record this call."). Per date, like recordings.

alter table public.community_calendar_event_exceptions
  add column if not exists no_recording_note text;
