-- CRM contact id from GoHighLevel / Pro Coach Platform (set via inbound webhook).

alter table public.contacts
  add column if not exists crm_contact_id text;

create index if not exists contacts_crm_contact_id_idx
  on public.contacts (crm_contact_id)
  where crm_contact_id is not null;

comment on column public.contacts.crm_contact_id is
  'GoHighLevel / Pro Coach Platform contact id; synced from inbound GHL workflow webhook.';
