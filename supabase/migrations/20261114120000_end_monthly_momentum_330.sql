-- End Monthly Momentum (3:30pm London / Coach of the Month) from 7 Sep 2026 onwards.
-- Keeps the 3 Aug 2026 occurrence; removes 7 Sep 2026 and all later first-Mondays.

UPDATE community_calendar_events
SET
  recurrence = jsonb_set(
    jsonb_set(
      COALESCE(recurrence, '{}'::jsonb) - 'maxOccurrences',
      '{end}',
      '"on"'
    ),
    '{endDate}',
    '"2026-09-06"'
  )
WHERE id = 'c8f10000-0000-4000-a000-000000000003';
