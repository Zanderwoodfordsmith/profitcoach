-- Secret token for personal community calendar ICS subscribe feeds.
-- Calendar clients poll the public feed URL with this token (no session cookies).

alter table public.profiles
  add column if not exists community_calendar_feed_token uuid;

update public.profiles
set community_calendar_feed_token = gen_random_uuid()
where community_calendar_feed_token is null
  and role in ('coach', 'admin');

create unique index if not exists profiles_community_calendar_feed_token_key
  on public.profiles (community_calendar_feed_token)
  where community_calendar_feed_token is not null;

comment on column public.profiles.community_calendar_feed_token is
  'Secret token for /api/community/calendar/feed/{token} ICS subscribe URL.';
