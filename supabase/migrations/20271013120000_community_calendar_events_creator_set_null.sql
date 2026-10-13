-- Calendar events are shared company content, not something a person owns.
-- Deleting the profile that created a series used to cascade-delete the series
-- and every session recording on it (10 Oct 2026: removing former staff wiped
-- Win The Week and Profit Coach Training). Keep the events when a person goes.

alter table public.community_calendar_events
  alter column created_by drop not null;

alter table public.community_calendar_events
  drop constraint if exists community_calendar_events_created_by_fkey;

alter table public.community_calendar_events
  add constraint community_calendar_events_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- Existing series are not tied to anyone.
update public.community_calendar_events
set created_by = null
where created_by is not null;
