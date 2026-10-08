-- Commercial fields for a coach's client roster (Keep Clients).
-- Join date, monthly fee, and problem notes sit on the contact so the
-- same person can also carry a BOSS Score.

alter table public.contacts
  add column if not exists client_joined_on date,
  add column if not exists client_fee_amount numeric(12, 2),
  add column if not exists client_problem_notes text;

alter table public.contacts
  drop constraint if exists contacts_client_fee_amount_nonnegative;

alter table public.contacts
  add constraint contacts_client_fee_amount_nonnegative
  check (client_fee_amount is null or client_fee_amount >= 0);

comment on column public.contacts.client_joined_on is
  'Date this person became the coach''s paying client.';

comment on column public.contacts.client_fee_amount is
  'Monthly fee the coach charges this client, in GBP.';

comment on column public.contacts.client_problem_notes is
  'Coach notes on the client situation or the problem being worked.';
