-- Monthly Momentum from 3 Aug 2026 onwards: 3:30–4:00pm Europe/London (30 min).
-- Simplify description: Coach of the Month + Compass; drop Flight Plan.

UPDATE community_calendar_events
SET
  starts_at = '2026-08-03T14:30:00+00'::timestamptz, -- 15:30 BST
  ends_at = '2026-08-03T15:00:00+00'::timestamptz,   -- 16:00 BST
  description = $desc$Half an hour to reset your month.

We celebrate Coach of the Month, take a quick look at your Compass, and set your focus for the weeks ahead — so you leave clear on what matters most for the next 30 days.$desc$
WHERE id = 'c8f10000-0000-4000-a000-000000000003';
