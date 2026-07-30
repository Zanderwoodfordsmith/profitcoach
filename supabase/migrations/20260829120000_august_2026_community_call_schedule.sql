-- August 2026 community call schedule changes:
-- 1) End Wednesday coach calls after July 2026 (no occurrences from Wed 5 Aug onwards)
-- 2) End New Member Kick-off after July 2026
-- 3) Win The Week + Profit Coach Training move to 4pm Europe/London from 1 Aug 2026
-- 4) Monthly Momentum moves to 3pm Europe/London from 1 Aug 2026
-- Pre-August occurrences keep their existing times via series end + new series split.

-- End the four Wednesday coach-call series after the last July 2026 slot (29 Jul).
UPDATE community_calendar_events
SET recurrence = (recurrence - 'maxOccurrences')
  || jsonb_build_object('end', 'on', 'endDate', '2026-07-31')
WHERE id IN (
  'c34272d5-3d65-47ec-9c29-b3bfae873fa5', -- COACH Certification
  'b984aa29-a933-4860-9c0b-c4ae7b65f67e', -- Lead Engine
  'e6e94321-092d-4a59-abd8-85ee3e34b647', -- Signing Clients
  'e5e5dc41-39a0-4cd8-8245-946cddea1704'  -- Coaching Delivery
);

-- End New Member Kick-off after July 2026 (no Aug 4+ occurrences).
UPDATE community_calendar_events
SET recurrence = (recurrence - 'maxOccurrences')
  || jsonb_build_object('end', 'on', 'endDate', '2026-07-31')
WHERE id = 'b0eef000-0000-4000-a000-000000000001';

-- End pre-August Win The Week / Profit Coach Training / Monthly Momentum series.
UPDATE community_calendar_events
SET recurrence = (recurrence - 'maxOccurrences')
  || jsonb_build_object('end', 'on', 'endDate', '2026-07-31')
WHERE id IN (
  'd1ae0ec5-0594-4a49-ac2b-ab18cb6a4a83', -- Win The Week (1pm)
  '8ceef792-c4b5-4418-b204-f015fc39eab5', -- Profit Coach Training (1pm)
  '6ca4cc73-0a5e-4f89-9a07-3cc77469f637'  -- Monthly Momentum (12pm)
);

-- Win The Week from Aug 2026: Mondays 4–5pm London
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
  'c8f10000-0000-4000-a000-000000000001'::uuid,
  e.created_by,
  e.title,
  e.description,
  e.cover_image_url,
  '2026-08-03T15:00:00+00'::timestamptz, -- 16:00 BST
  '2026-08-03T16:00:00+00'::timestamptz,
  'Europe/London',
  e.location_kind,
  e.location_url,
  true,
  '{
    "end": "after",
    "unit": "week",
    "interval": 1,
    "weekdays": [0],
    "maxOccurrences": 52
  }'::jsonb,
  e.access_tags
FROM community_calendar_events e
WHERE e.id = 'd1ae0ec5-0594-4a49-ac2b-ab18cb6a4a83'
  AND NOT EXISTS (
    SELECT 1
    FROM community_calendar_events n
    WHERE n.id = 'c8f10000-0000-4000-a000-000000000001'
  );

-- Profit Coach Training from Aug 2026: Thursdays 4–5pm London
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
  'c8f10000-0000-4000-a000-000000000002'::uuid,
  e.created_by,
  e.title,
  e.description,
  e.cover_image_url,
  '2026-08-06T15:00:00+00'::timestamptz, -- 16:00 BST
  '2026-08-06T16:00:00+00'::timestamptz,
  'Europe/London',
  e.location_kind,
  e.location_url,
  true,
  '{
    "end": "after",
    "unit": "week",
    "interval": 1,
    "weekdays": [3],
    "maxOccurrences": 52
  }'::jsonb,
  e.access_tags
FROM community_calendar_events e
WHERE e.id = '8ceef792-c4b5-4418-b204-f015fc39eab5'
  AND NOT EXISTS (
    SELECT 1
    FROM community_calendar_events n
    WHERE n.id = 'c8f10000-0000-4000-a000-000000000002'
  );

-- Monthly Momentum from Aug 2026: 1st Monday 3–4pm London
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
  'c8f10000-0000-4000-a000-000000000003'::uuid,
  e.created_by,
  e.title,
  e.description,
  e.cover_image_url,
  '2026-08-03T14:00:00+00'::timestamptz, -- 15:00 BST
  '2026-08-03T15:00:00+00'::timestamptz,
  'Europe/London',
  e.location_kind,
  e.location_url,
  true,
  '{
    "end": "after",
    "unit": "month",
    "interval": 1,
    "weekdays": [],
    "monthMode": "ordinal_weekday",
    "monthOrdinal": 1,
    "monthWeekday": 0,
    "maxOccurrences": 24
  }'::jsonb,
  e.access_tags
FROM community_calendar_events e
WHERE e.id = '6ca4cc73-0a5e-4f89-9a07-3cc77469f637'
  AND NOT EXISTS (
    SELECT 1
    FROM community_calendar_events n
    WHERE n.id = 'c8f10000-0000-4000-a000-000000000003'
  );
