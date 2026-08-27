-- Explicit prospect acquisition source (Sales Navigator, manual, BOSS Score, etc.)
alter table public.contacts
  add column if not exists prospect_source text;

comment on column public.contacts.prospect_source is
  'How this prospect entered the pipeline: sales_navigator, manual, linkedin, boss_score, boss_pro, bca, ghl, etc.';

create index if not exists contacts_prospect_source_idx
  on public.contacts (prospect_source)
  where type = 'prospect' and prospect_source is not null;
