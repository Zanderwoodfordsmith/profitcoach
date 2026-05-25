-- Coach live-scoring answers (BOSS grid colours) — workshop session state on the contact.
alter table public.contacts
  add column if not exists session_answers jsonb not null default '{}'::jsonb;

comment on column public.contacts.session_answers is
  'JSON object keyed by BOSS question ref (0|1|2). Coach workshop session scores — separate from prospect diagnostic assessments.';
