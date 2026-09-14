-- Editable booking confirmation + reminder sequence (per coach).
-- reminder_sends records which steps already went out for a booking.

alter table public.coach_booking_settings
  add column if not exists reminder_sequence jsonb not null default '[]'::jsonb;

comment on column public.coach_booking_settings.reminder_sequence is
  'Ordered confirmation + reminder steps (channels, copy, minutes-before). Empty array means product defaults.';

alter table public.bookings
  add column if not exists reminder_sends jsonb not null default '{}'::jsonb;

comment on column public.bookings.reminder_sends is
  'Map of reminder step id → ISO timestamp when that step was attempted.';
