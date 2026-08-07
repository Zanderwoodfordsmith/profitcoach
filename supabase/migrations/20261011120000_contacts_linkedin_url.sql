-- LinkedIn profile URL on contacts (pipeline prospects from Chrome extension).

alter table public.contacts
  add column if not exists linkedin_url text;

comment on column public.contacts.linkedin_url is
  'Canonical https://www.linkedin.com/in/{slug} when known; used to upsert from the LinkedIn extension.';

create unique index if not exists contacts_coach_linkedin_url_uidx
  on public.contacts (coach_id, linkedin_url)
  where linkedin_url is not null and coach_id is not null;
