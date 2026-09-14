-- Cache the connected coach's own LinkedIn SSI. Never another person's score.

alter table public.linkedin_outreach_accounts
  add column if not exists ssi_score numeric,
  add column if not exists ssi_industry_top numeric,
  add column if not exists ssi_network_top numeric,
  add column if not exists ssi_fetched_at timestamptz,
  add column if not exists ssi_error text;

comment on column public.linkedin_outreach_accounts.ssi_score is
  'Cached LinkedIn Social Selling Index (0-100) for this connected account only.';
