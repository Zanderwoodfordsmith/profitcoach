-- Shared LeadRocks / Apify lead cache. Search local first; fill gaps via Apify.

create table if not exists public.leadrocks_leads (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  full_name text,
  first_name text,
  last_name text,
  job_title text,
  email text,
  phone text,
  linkedin_url text,
  company text,
  company_website text,
  location text,
  state text,
  industry text,
  category text,
  category_slug text,
  team_size text,
  revenue_range text,
  raw jsonb not null default '{}'::jsonb,
  source text not null default 'leadrocks_apify',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists leadrocks_leads_job_title_idx
  on public.leadrocks_leads (lower(job_title));
create index if not exists leadrocks_leads_state_idx
  on public.leadrocks_leads (state);
create index if not exists leadrocks_leads_industry_idx
  on public.leadrocks_leads (lower(industry));
create index if not exists leadrocks_leads_company_idx
  on public.leadrocks_leads (lower(company));
create index if not exists leadrocks_leads_category_idx
  on public.leadrocks_leads (lower(category));
create index if not exists leadrocks_leads_location_lower_idx
  on public.leadrocks_leads (lower(location));

alter table public.leadrocks_leads enable row level security;

drop policy if exists "Admins read leadrocks leads"
  on public.leadrocks_leads;
create policy "Admins read leadrocks leads"
  on public.leadrocks_leads
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
