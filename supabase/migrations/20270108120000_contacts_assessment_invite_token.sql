-- Opaque invite token for personalised assessment links.
-- Resolves the click back to the existing contact (e.g. LinkedIn campaign
-- leads with no email) without putting a profile URL in the query string.

alter table public.contacts
  add column if not exists assessment_invite_token uuid default gen_random_uuid();

update public.contacts
set assessment_invite_token = gen_random_uuid()
where assessment_invite_token is null;

alter table public.contacts
  alter column assessment_invite_token set not null;

create unique index if not exists contacts_assessment_invite_token_key
  on public.contacts (assessment_invite_token);

comment on column public.contacts.assessment_invite_token is
  'Secret token for personalised /assessment links (?c=). Identifies the contact without email or LinkedIn in the URL.';
