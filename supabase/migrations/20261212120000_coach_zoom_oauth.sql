-- Per-coach Zoom OAuth (unique meeting links on bookings).
-- Tokens are service-role only — RLS on, no authenticated/anon policies.

alter table public.coach_calendars
  drop constraint if exists coach_calendars_location_mode_check;
alter table public.coach_calendars
  add constraint coach_calendars_location_mode_check
  check (location_mode in ('google_meet', 'zoom', 'phone', 'custom'));

alter table public.coach_booking_settings
  drop constraint if exists coach_booking_settings_location_mode_check;
alter table public.coach_booking_settings
  add constraint coach_booking_settings_location_mode_check
  check (location_mode in ('google_meet', 'zoom', 'phone', 'custom'));

comment on column public.coach_booking_settings.location_mode is
  'How the call happens: google_meet, zoom (unique Zoom meeting), phone, or custom text/URL.';

create table if not exists public.coach_zoom_connections (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  zoom_user_id text,
  zoom_email text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coach_zoom_connections is
  'Per-coach Zoom OAuth tokens. Service-role only. Used to create unique meetings on booking.';

create or replace function public.set_coach_zoom_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coach_zoom_connections_updated_at
  on public.coach_zoom_connections;
create trigger trg_coach_zoom_connections_updated_at
before update on public.coach_zoom_connections
for each row execute function public.set_coach_zoom_connections_updated_at();

alter table public.coach_zoom_connections enable row level security;

alter table public.bookings
  add column if not exists zoom_meeting_id text;

comment on column public.bookings.zoom_meeting_id is
  'Zoom meeting id for this booking. Used to delete the meeting on cancel.';
