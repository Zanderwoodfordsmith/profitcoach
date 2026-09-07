-- Bridge LinkedIn vanity URLs ↔ provider member ids (ACo… / ACw…).
-- Scrapers and Unipile may supply either form; we store both for matching.

alter table public.contacts
  add column if not exists linkedin_provider_id text;

comment on column public.contacts.linkedin_provider_id is
  'LinkedIn member/provider id (ACo…/ACw…). Stable across vanity URL changes.';

create unique index if not exists contacts_coach_linkedin_provider_id_uidx
  on public.contacts (coach_id, linkedin_provider_id)
  where linkedin_provider_id is not null and coach_id is not null;

create index if not exists contacts_linkedin_provider_id_idx
  on public.contacts (linkedin_provider_id)
  where linkedin_provider_id is not null;

alter table public.messaging_conversations
  add column if not exists prospect_linkedin_provider_id text;

comment on column public.messaging_conversations.prospect_linkedin_provider_id is
  'LinkedIn provider/member id for the counterpart (from Unipile attendee).';

create index if not exists messaging_conversations_li_provider_idx
  on public.messaging_conversations (coach_id, prospect_linkedin_provider_id)
  where prospect_linkedin_provider_id is not null;
