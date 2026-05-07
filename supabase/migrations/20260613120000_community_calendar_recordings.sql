alter table public.community_calendar_events
  add column if not exists recording_link_url text,
  add column if not exists recording_video_url text;

alter table public.community_calendar_events
  drop constraint if exists community_calendar_events_recording_link_url_check;

alter table public.community_calendar_events
  add constraint community_calendar_events_recording_link_url_check
  check (
    recording_link_url is null
    or recording_link_url ~* '^https?://'
  );

alter table public.community_calendar_events
  drop constraint if exists community_calendar_events_recording_video_url_check;

alter table public.community_calendar_events
  add constraint community_calendar_events_recording_video_url_check
  check (
    recording_video_url is null
    or recording_video_url ~* '^https?://'
  );
