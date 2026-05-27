-- Per-occurrence recordings and explicit cancellation for recurring events

alter table public.community_calendar_event_exceptions
  add column if not exists cancelled_at timestamptz,
  add column if not exists recording_link_url text,
  add column if not exists recording_video_url text;

update public.community_calendar_event_exceptions
set cancelled_at = created_at
where cancelled_at is null;

alter table public.community_calendar_event_exceptions
  drop constraint if exists community_calendar_event_exceptions_recording_link_url_check;

alter table public.community_calendar_event_exceptions
  add constraint community_calendar_event_exceptions_recording_link_url_check
  check (
    recording_link_url is null
    or recording_link_url ~* '^https?://'
  );

alter table public.community_calendar_event_exceptions
  drop constraint if exists community_calendar_event_exceptions_recording_video_url_check;

alter table public.community_calendar_event_exceptions
  add constraint community_calendar_event_exceptions_recording_video_url_check
  check (
    recording_video_url is null
    or recording_video_url ~* '^https?://'
  );
