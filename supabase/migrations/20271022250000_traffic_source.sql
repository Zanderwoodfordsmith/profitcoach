-- Where people came from: the tag on the link they opened (utm_source or the
-- short ?src=), saved with their BOSS Score and on their contact.
alter table public.assessments
  add column if not exists traffic_source text,
  add column if not exists traffic_medium text,
  add column if not exists traffic_campaign text;

-- First tagged visit wins on the contact; each BOSS Score keeps its own.
alter table public.contacts
  add column if not exists traffic_source text,
  add column if not exists traffic_medium text,
  add column if not exists traffic_campaign text;

create index if not exists assessments_traffic_source_idx
  on public.assessments (coach_id, traffic_source) where traffic_source is not null;
