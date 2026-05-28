-- Coach community calls: schedule on the day after the Nth Tuesday of each month
-- (not the Nth Wednesday). June 2026 onboarding shift stays as reschedule exceptions.
-- July 2026 uses the natural day-after-Tuesday dates (8/15/22/29) — no extra exceptions.

UPDATE community_calendar_events
SET recurrence = (recurrence - 'monthWeekday') || '{"monthMode": "day_after_ordinal_tuesday"}'::jsonb
WHERE id IN (
  'c34272d5-3d65-47ec-9c29-b3bfae873fa5', -- COACH Certification (1st)
  'b984aa29-a933-4860-9c0b-c4ae7b65f67e', -- Lead Engine (2nd)
  'e6e94321-092d-4a59-abd8-85ee3e34b647', -- Signing Clients (3rd)
  'e5e5dc41-39a0-4cd8-8245-946cddea1704'  -- Coaching Delivery (4th)
);

DELETE FROM community_calendar_events
WHERE id IN (
  '5d8048d7-c747-49ae-9db2-20cc353db296', -- duplicate Coaching Delivery 27 May 2026
  '0750f06a-3ce8-4c77-af88-e82ffd7e5e80', -- duplicate Coaching Delivery 26 Aug 2026
  'f74b2463-ce66-48c6-8244-014c74f2c75d', -- duplicate Coaching Delivery 28 Oct 2026
  'b7f0082e-c034-4392-93c0-8ab960e10df7', -- duplicate Coaching Delivery 25 Nov 2026
  -- May 2026 Lead Engine conference make-up restored in 20260731200000_restore_may_2026_lead_engine.sql
);

-- Catch any other stray one-offs for the four coach call series (not conference make-up).
DELETE FROM community_calendar_events
WHERE is_recurring = false
  AND title IN (
    'COACH Certification',
    'Lead Engine',
    'Signing Clients',
    'Coaching Delivery'
  )
  AND id <> 'ed3a5920-fabd-495d-8211-752f4263ced6'::uuid;

-- Remove all reschedule exceptions except June 2026 onboarding (+7 day shift).
DELETE FROM community_calendar_event_exceptions ex
WHERE ex.rescheduled_starts_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('c34272d5-3d65-47ec-9c29-b3bfae873fa5'::uuid, '2026-06-03T12:00:00+00'::timestamptz),
        ('b984aa29-a933-4860-9c0b-c4ae7b65f67e'::uuid, '2026-06-10T12:00:00+00'::timestamptz),
        ('e6e94321-092d-4a59-abd8-85ee3e34b647'::uuid, '2026-06-17T12:00:00+00'::timestamptz),
        ('e5e5dc41-39a0-4cd8-8245-946cddea1704'::uuid, '2026-06-24T12:00:00+00'::timestamptz)
    ) AS keep(event_id, occurrence_start)
    WHERE keep.event_id = ex.event_id
      AND keep.occurrence_start = ex.occurrence_start
  );
