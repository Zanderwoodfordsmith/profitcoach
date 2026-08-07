-- GHL Members export enrichment: fill-blanks contact fields + opaque jsonb blob.

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists ghl_member_enrichment jsonb;

comment on column public.profiles.phone is
  'Coach phone from GHL Members export (or later sources); fill blanks only.';
comment on column public.profiles.job_title is
  'Former/current job title from GHL lead form (e.g. MD, Founder); fill blanks only.';
comment on column public.profiles.ghl_member_enrichment is
  'Opaque GHL Members export fields (summaries, exec years, LinkedIn ad attribution).';
  'Merged on import; does not overwrite existing keys with nulls.';
