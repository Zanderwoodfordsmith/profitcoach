-- Cache Unipile "is this number on WhatsApp?" lookups on contacts.
-- Re-check when phone digits change or cache is stale (app-enforced TTL).

alter table public.contacts
  add column if not exists whatsapp_on boolean,
  add column if not exists whatsapp_checked_at timestamptz,
  add column if not exists whatsapp_checked_phone text;

comment on column public.contacts.whatsapp_on is
  'True when Unipile confirmed this phone is registered on WhatsApp (or we have a WA thread). False when checked and not on WA. Null = not checked.';

comment on column public.contacts.whatsapp_checked_at is
  'When whatsapp_on was last verified via Unipile or inferred from a synced WhatsApp chat.';

comment on column public.contacts.whatsapp_checked_phone is
  'Digits-only phone that whatsapp_on applies to; invalidate when contacts.phone changes.';

create index if not exists contacts_whatsapp_on_idx
  on public.contacts (coach_id, whatsapp_on)
  where whatsapp_on is true;
