-- Freeform tags on prospects (GHL-style chips in the right sidebar).
alter table public.contacts
  add column if not exists prospect_tags text[] not null default '{}';

comment on column public.contacts.prospect_tags is
  'Coach-defined labels on a prospect (add/remove from the prospect sidebar).';

create index if not exists contacts_prospect_tags_gin
  on public.contacts using gin (prospect_tags);
