-- Per-calendar confirmation + reminder sequences.
-- Copies any existing coach-level sequence onto calendars so current
-- customisations stay in place; empty calendar JSON still falls back to
-- coach_booking_settings.reminder_sequence at read time.

alter table public.coach_calendars
  add column if not exists reminder_sequence jsonb not null default '[]'::jsonb;

comment on column public.coach_calendars.reminder_sequence is
  'Ordered confirmation + reminder steps for this calendar. Empty array means fall back to coach_booking_settings then product defaults.';

update public.coach_calendars c
set reminder_sequence = s.reminder_sequence
from public.coach_booking_settings s
where s.coach_id = c.coach_id
  and jsonb_typeof(s.reminder_sequence) = 'array'
  and jsonb_array_length(s.reminder_sequence) > 0
  and (
    jsonb_typeof(c.reminder_sequence) is distinct from 'array'
    or jsonb_array_length(c.reminder_sequence) = 0
  );

comment on column public.coach_booking_settings.reminder_sequence is
  'Fallback confirmation + reminder steps when a calendar has no sequence of its own.';
