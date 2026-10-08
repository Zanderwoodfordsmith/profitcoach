-- Orientation call: Pam's standing Zoom room, and a short reminder schedule
-- (confirmation, 24 hours, 1 hour). Sent copy is rendered in code from the step id.

update public.coach_calendars cc
set
  location_mode = 'custom',
  location_custom = 'https://theprofitcoach.com/zoom-pam',
  location_phone = null,
  reminder_sequence = '[
    {
      "id": "confirmation",
      "kind": "confirmation",
      "enabled": true,
      "minutes_before": 0,
      "email": true,
      "sms": false,
      "subject": "You''re booked — orientation call with Pam",
      "body": "Hi {{first_name}},\n\nYou''re booked for your orientation call with Pam.\n\nWhen: {{when}}\nWhere: {{where}}\n\nBefore the call: welcome video, the short questions on that page, then Classroom → Start Here → Welcome & Program Overview, then Pick Your Path.\n\nPam"
    },
    {
      "id": "24h",
      "kind": "reminder",
      "enabled": true,
      "minutes_before": 1440,
      "email": true,
      "sms": false,
      "subject": "Tomorrow: your orientation call with Pam",
      "body": "Hi {{first_name}},\n\nYour orientation call with Pam is tomorrow.\n\nWhen: {{when}}\nWhere: {{where}}\n\nHow are you getting on in the programme? Reply with a sentence or two.\n\nPam"
    },
    {
      "id": "1h",
      "kind": "reminder",
      "enabled": true,
      "minutes_before": 60,
      "email": true,
      "sms": false,
      "subject": "In an hour: orientation call with Pam",
      "body": "Hi {{first_name}},\n\nYour orientation call with Pam starts in about an hour.\n\nWhen: {{when}}\nWhere: {{where}}\n\nPam"
    }
  ]'::jsonb,
  updated_at = now()
from public.coaches c
where cc.coach_id = c.id
  and c.slug = 'zander'
  and cc.slug = 'onboarding';
