-- Google Calendar OAuth for native booking (busy blocking + event create).
-- Location prefs on coach_booking_settings; meeting details on bookings.

alter table public.coach_booking_settings
  add column if not exists location_mode text not null default 'google_meet'
    check (location_mode in ('google_meet', 'phone', 'custom')),
  add column if not exists location_phone text,
  add column if not exists location_custom text;

comment on column public.coach_booking_settings.location_mode is
  'How the call happens: google_meet (Calendar Meet link), phone, or custom text/URL.';

create table if not exists public.coach_google_calendar_connections (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  google_account_email text,
  google_account_id text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  -- Calendars whose busy blocks bookable slots (Google calendar ids).
  busy_calendar_ids text[] not null default '{}',
  -- Calendar where new booking events are written (default "primary").
  event_calendar_id text not null default 'primary',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coach_google_calendar_connections is
  'Per-coach Google Calendar OAuth tokens + which calendars block / receive events. Service-role only.';

create or replace function public.set_coach_google_calendar_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coach_google_calendar_connections_updated_at
  on public.coach_google_calendar_connections;
create trigger trg_coach_google_calendar_connections_updated_at
before update on public.coach_google_calendar_connections
for each row execute function public.set_coach_google_calendar_connections_updated_at();

alter table public.bookings
  add column if not exists google_event_id text,
  add column if not exists google_calendar_id text,
  add column if not exists meeting_location_type text,
  add column if not exists meeting_join_url text,
  add column if not exists meeting_phone text,
  add column if not exists meeting_instructions text;

-- Tokens must never be readable via PostgREST anon/authenticated.
alter table public.coach_google_calendar_connections enable row level security;

-- No policies for authenticated/anon — access only via service role.
