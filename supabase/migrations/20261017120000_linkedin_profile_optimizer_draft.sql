-- Paste-ready LinkedIn profile copy, stored beside the scrape snapshot.
-- One draft blob per coach; RLS on coach_linkedin_profiles already scopes
-- select/insert/update/delete to the owning coach (and admin read).

alter table public.coach_linkedin_profiles
  add column if not exists optimizer_draft jsonb not null default '{}'::jsonb;

alter table public.coach_linkedin_profiles
  add column if not exists optimizer_rewritten_at timestamptz;

