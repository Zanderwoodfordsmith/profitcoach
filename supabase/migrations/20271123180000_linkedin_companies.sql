-- What a company does, for the lead hover card (23 Nov): coaches tell at a
-- glance whether a business is right. Public LinkedIn company pages, looked up
-- once per company the first time someone hovers a person there, then shared
-- by every coach. Server only (service role); no client policies.
create table if not exists public.linkedin_companies (
  company_id text primary key,
  name text,
  description text,
  tagline text,
  industry text,
  employee_count integer,
  employee_range text,
  website text,
  founded text,
  head_office text,
  profile_url text,
  -- false when the lookup found nothing, so it isn't retried every hover.
  found boolean not null default true,
  fetched_at timestamptz not null default now()
);

alter table public.linkedin_companies enable row level security;
