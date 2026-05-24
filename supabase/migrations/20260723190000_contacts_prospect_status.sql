-- Manual prospect pipeline status (auto-derived in UI when null).

alter table public.contacts
  add column if not exists prospect_status text;

comment on column public.contacts.prospect_status is
  'Coach-set prospect pipeline status. When null, the app derives status from assessments and GHL calls.';
