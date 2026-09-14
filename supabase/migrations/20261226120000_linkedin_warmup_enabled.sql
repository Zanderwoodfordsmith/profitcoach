-- Allow coaches to skip the LinkedIn invite warm-up ramp.

alter table public.linkedin_outreach_accounts
  add column if not exists warmup_enabled boolean not null default true;

comment on column public.linkedin_outreach_accounts.warmup_enabled is
  'When false, invite volume uses the full weekly target (no warm-up ramp).';
