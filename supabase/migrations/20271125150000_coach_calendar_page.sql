-- A calendar's public page settings: which contact details show on the booking page,
-- and (for the first call) the sales page words. Additive; empty means the defaults.
alter table public.coach_calendars
  add column if not exists page jsonb not null default '{}'::jsonb;

comment on column public.coach_calendars.page is
  'Booking page settings and the call sales page words. { hidden: { phone, email, whatsapp }, sales: {...} }';
