-- Track whether the T-1h booking reminder has been sent.
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

create index if not exists bookings_reminder_due_idx
  on public.bookings (starts_at)
  where status = 'booked' and reminder_sent_at is null;

comment on column public.bookings.reminder_sent_at is
  'When the pre-call reminder (email/SMS) was sent; null if not yet.';
