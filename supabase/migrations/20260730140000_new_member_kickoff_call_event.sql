-- New Member Kick-off Call: 1st Tuesday of each month, 1–3pm London, online link.
-- May 2026 skipped (conference); June 2026 uses 2nd Tuesday (onboarding shift).

INSERT INTO community_calendar_events (
  id,
  created_by,
  title,
  description,
  cover_image_url,
  starts_at,
  ends_at,
  display_timezone,
  location_kind,
  location_url,
  is_recurring,
  recurrence,
  access_tags
)
SELECT
  'b0eef000-0000-4000-a000-000000000001'::uuid,
  e.created_by,
  'New Member Kick-off Call',
  '',
  NULL,
  '2026-01-06T13:00:00+00'::timestamptz,
  '2026-01-06T15:00:00+00'::timestamptz,
  'Europe/London',
  'link',
  'https://businesscoachacademy.com/calls',
  true,
  '{
    "end": "after",
    "unit": "month",
    "interval": 1,
    "weekdays": [],
    "monthMode": "ordinal_weekday",
    "monthOrdinal": 1,
    "monthWeekday": 1,
    "maxOccurrences": 52
  }'::jsonb,
  COALESCE(e.access_tags, ARRAY['alumni', 'pro', 'premium']::text[])
FROM public.community_calendar_events e
WHERE e.title = 'COACH Certification'
  AND NOT EXISTS (
    SELECT 1
    FROM public.community_calendar_events k
    WHERE k.title = 'New Member Kick-off Call'
  )
LIMIT 1;

-- May 2026 — no kick-off (BCA Conference month); omitted in 20260730150000_community_calendar_exception_omit.sql

-- June 2026 — 2nd Tuesday instead of 1st (onboarding 9 Jun)
INSERT INTO public.community_calendar_event_exceptions (
  event_id,
  occurrence_start,
  rescheduled_starts_at,
  rescheduled_ends_at,
  cancelled_at,
  cancellation_reason
)
VALUES (
  'b0eef000-0000-4000-a000-000000000001'::uuid,
  '2026-06-02T12:00:00+00'::timestamptz,
  '2026-06-09T12:00:00+00'::timestamptz,
  '2026-06-09T14:00:00+00'::timestamptz,
  NULL,
  NULL
)
ON CONFLICT (event_id, occurrence_start) DO UPDATE
SET
  rescheduled_starts_at = EXCLUDED.rescheduled_starts_at,
  rescheduled_ends_at = EXCLUDED.rescheduled_ends_at,
  cancelled_at = NULL,
  cancellation_reason = NULL;
