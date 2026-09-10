-- Support call calendar (20 min) for platform admins Zander + Pam.
-- Public page: /support-call

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
  sort_order
)
select
  c.id,
  'support',
  'Support call',
  20,
  0,
  2,
  14,
  true,
  true,
  'google_meet',
  5
from public.coaches c
where c.slug in ('zander', 'pam')
on conflict (coach_id, slug) do update set
  name = excluded.name,
  meeting_duration_minutes = excluded.meeting_duration_minutes,
  is_enabled = true,
  is_public = true,
  location_mode = excluded.location_mode,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Seed default calendars for Pam if she has none yet (besides support).
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
  sort_order
)
select
  c.id,
  d.slug,
  d.name,
  d.duration,
  0,
  24,
  14,
  false,
  false,
  'google_meet',
  d.sort_order
from public.coaches c
cross join (
  values
    ('discovery', 'Discovery call', 15, 0),
    ('value-session', 'Value session', 45, 1),
    ('follow-up', 'Follow-up', 30, 2),
    ('coaching', 'Coaching session', 90, 3),
    ('onboarding', 'Onboarding', 120, 4)
) as d(slug, name, duration, sort_order)
where c.slug = 'pam'
  and not exists (
    select 1
    from public.coach_calendars existing
    where existing.coach_id = c.id
      and existing.slug = d.slug
  );

-- Default weekday hours for Pam if missing (Mon–Fri 09:00–17:00 Europe/London).
insert into public.coach_booking_settings (
  coach_id,
  timezone,
  meeting_duration_minutes,
  buffer_minutes,
  min_notice_hours,
  booking_window_days,
  is_enabled,
  title,
  location_mode
)
select
  c.id,
  'Europe/London',
  20,
  0,
  2,
  14,
  true,
  'Support call',
  'google_meet'
from public.coaches c
where c.slug = 'pam'
on conflict (coach_id) do nothing;

insert into public.coach_availability_rules (
  coach_id,
  weekday,
  start_time,
  end_time
)
select
  c.id,
  d.weekday,
  '09:00:00'::time,
  '17:00:00'::time
from public.coaches c
cross join (values (1), (2), (3), (4), (5)) as d(weekday)
where c.slug = 'pam'
  and not exists (
    select 1
    from public.coach_availability_rules r
    where r.coach_id = c.id
  );
