-- Multi-calendar booking: coach_calendars + bookings.calendar_id
-- Seeds Discovery / Value session / Follow-up / Coaching / Onboarding per coach.

create table if not exists public.coach_calendars (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  meeting_duration_minutes integer not null default 15
    check (meeting_duration_minutes > 0 and meeting_duration_minutes <= 180),
  buffer_minutes integer not null default 0
    check (buffer_minutes >= 0 and buffer_minutes <= 120),
  min_notice_hours integer not null default 24
    check (min_notice_hours >= 0 and min_notice_hours <= 168),
  booking_window_days integer not null default 14
    check (booking_window_days >= 1 and booking_window_days <= 90),
  is_enabled boolean not null default false,
  is_public boolean not null default false,
  location_mode text not null default 'google_meet'
    check (location_mode in ('google_meet', 'phone', 'custom')),
  location_phone text,
  location_custom text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_calendars_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint coach_calendars_coach_slug_uidx unique (coach_id, slug)
);

create index if not exists coach_calendars_coach_sort_idx
  on public.coach_calendars (coach_id, sort_order, name);

comment on table public.coach_calendars is
  'Per-coach bookable calendars (Discovery, Value session, etc.) with own duration/rules/public link.';

create or replace function public.set_coach_calendars_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coach_calendars_updated_at on public.coach_calendars;
create trigger trg_coach_calendars_updated_at
before update on public.coach_calendars
for each row execute function public.set_coach_calendars_updated_at();

alter table public.bookings
  add column if not exists calendar_id uuid references public.coach_calendars (id) on delete set null;

create index if not exists bookings_calendar_id_idx
  on public.bookings (calendar_id);

-- Seed default calendars for every coach that already has booking settings.
insert into public.coach_calendars (
  coach_id,
  slug,
  name,
  meeting_duration_minutes,
  buffer_minutes,
  min_notice_hours,
  booking_window_days,
  is_enabled,
  is_public,
  location_mode,
  location_phone,
  location_custom,
  sort_order
)
select
  s.coach_id,
  d.slug,
  d.name,
  case
    when d.slug = 'discovery' then coalesce(s.meeting_duration_minutes, d.duration)
    else d.duration
  end,
  case
    when d.slug = 'discovery' then coalesce(s.buffer_minutes, 0)
    else 0
  end,
  case
    when d.slug = 'discovery' then coalesce(s.min_notice_hours, 24)
    else 24
  end,
  case
    when d.slug = 'discovery' then coalesce(s.booking_window_days, 14)
    else 14
  end,
  case
    when d.slug = 'discovery' then coalesce(s.is_enabled, false)
    else false
  end,
  case
    when d.slug = 'discovery' then coalesce(s.is_enabled, false)
    else false
  end,
  case
    when d.slug = 'discovery' then coalesce(s.location_mode, 'google_meet')
    else 'google_meet'
  end,
  case when d.slug = 'discovery' then s.location_phone else null end,
  case when d.slug = 'discovery' then s.location_custom else null end,
  d.sort_order
from public.coach_booking_settings s
cross join (
  values
    ('discovery', 'Discovery call', 15, 0),
    ('value-session', 'Value session', 45, 1),
    ('follow-up', 'Follow-up', 30, 2),
    ('coaching', 'Coaching session', 90, 3),
    ('onboarding', 'Onboarding', 120, 4)
) as d(slug, name, duration, sort_order)
on conflict (coach_id, slug) do nothing;

-- Attach existing native bookings to Discovery calendar when possible.
update public.bookings b
set calendar_id = c.id
from public.coach_calendars c
where b.calendar_id is null
  and c.coach_id = b.coach_id
  and c.slug = 'discovery'
  and (b.kind is null or b.kind = 'discovery' or b.kind = '');

alter table public.coach_calendars enable row level security;

create policy "Coaches read own calendars"
  on public.coach_calendars for select
  using (coach_id = auth.uid());

create policy "Coaches insert own calendars"
  on public.coach_calendars for insert
  with check (coach_id = auth.uid());

create policy "Coaches update own calendars"
  on public.coach_calendars for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Coaches delete own calendars"
  on public.coach_calendars for delete
  using (coach_id = auth.uid());

create policy "Admins manage all calendars"
  on public.coach_calendars for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
