-- When intent signals were last pulled from LinkedIn for this account, so
-- opening Today doesn't re-scan posts and invites on every visit.
alter table public.linkedin_outreach_accounts
  add column if not exists intent_signals_refreshed_at timestamptz;
