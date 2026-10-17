-- Pam's Blueprint Call calendar. A copy of her support calendar
-- (hours stay on the coach, so the two calendars cannot double-book),
-- with its own name, page, and invite title.

insert into public.coach_calendars (
  coach_id,
  slug,
  name,
  description,
  meeting_duration_minutes,
  buffer_minutes,
  min_notice_hours,
  booking_window_days,
  is_enabled,
  is_public,
  location_mode,
  location_phone,
  location_custom,
  sort_order,
  reminder_sequence
)
select
  c.id,
  'advisory-blueprint',
  'Blueprint Call',
  'The call where you and Pam lock the market, the offer, the price, and the angle.',
  cc.meeting_duration_minutes,
  cc.buffer_minutes,
  cc.min_notice_hours,
  cc.booking_window_days,
  true,
  true,
  cc.location_mode,
  cc.location_phone,
  cc.location_custom,
  cc.sort_order + 1,
  '[
    {
      "id": "confirmation",
      "kind": "confirmation",
      "enabled": true,
      "minutes_before": 0,
      "email": true,
      "sms": false,
      "subject": "You''re booked — Blueprint Call with Pam",
      "body": "Hi {{first_name}},\n\nYou''re booked for your Blueprint Call with Pam.\n\nWhen: {{when}}\nWhere: {{where}}\n\nThis is where you lock one market, one offer, one price, and one angle.\n\nPam"
    },
    {
      "id": "24h",
      "kind": "reminder",
      "enabled": true,
      "minutes_before": 1440,
      "email": true,
      "sms": false,
      "subject": "Tomorrow: your Blueprint Call with Pam",
      "body": "Hi {{first_name}},\n\nYour Blueprint Call with Pam is tomorrow.\n\nWhen: {{when}}\nWhere: {{where}}\n\nPam"
    },
    {
      "id": "1h",
      "kind": "reminder",
      "enabled": true,
      "minutes_before": 60,
      "email": true,
      "sms": false,
      "subject": "In an hour: Blueprint Call with Pam",
      "body": "Hi {{first_name}},\n\nYour Blueprint Call with Pam starts in about an hour.\n\nWhen: {{when}}\nWhere: {{where}}\n\nPam"
    }
  ]'::jsonb
from public.coaches c
join public.coach_calendars cc
  on cc.coach_id = c.id
 and cc.slug = 'support'
where c.slug = 'pam'
on conflict (coach_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  reminder_sequence = excluded.reminder_sequence,
  is_enabled = true,
  is_public = true,
  updated_at = now();
