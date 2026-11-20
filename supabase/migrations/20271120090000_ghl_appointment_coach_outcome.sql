-- Coaches mark calendar (GHL) calls as completed or no-show. GHL never sends
-- this, and its webhook only writes status_normalized, so the coach's mark
-- lives in its own column and survives later GHL updates.

alter table public.ghl_appointments
  add column if not exists coach_outcome text
    check (coach_outcome in ('completed', 'noshow')),
  add column if not exists coach_outcome_at timestamptz;

comment on column public.ghl_appointments.coach_outcome is
  'Set by the coach or BCA on the Calls page: completed or noshow. Null = not marked; status_normalized then shows.';
