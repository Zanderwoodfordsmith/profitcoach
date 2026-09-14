-- Cached LinkedIn SSI pillar scores (0-25 each) for the connected account only.

alter table public.linkedin_outreach_accounts
  add column if not exists ssi_pillars jsonb not null default '{}'::jsonb;

comment on column public.linkedin_outreach_accounts.ssi_pillars is
  'Cached LinkedIn SSI pillars for this connected account only. Keys: brand, people, engagement, relationships (0-25).';
