-- Per-lead tenure from Sales Nav Short scrapes (free with search import).
-- months_* support range queries; years_at_company_bucket matches Sales Nav chips.

alter table public.leadrocks_leads
  add column if not exists months_at_company integer,
  add column if not exists months_in_role integer,
  add column if not exists years_at_company_bucket text;

comment on column public.leadrocks_leads.months_at_company is
  'Total months in current company from Sales Nav Short (years*12 + months).';
comment on column public.leadrocks_leads.months_in_role is
  'Total months in current role from Sales Nav Short.';
comment on column public.leadrocks_leads.years_at_company_bucket is
  'Sales Nav YEARS_AT_CURRENT_COMPANY id: 1=<1yr, 2=1-2, 3=3-5, 4=6-10, 5=10+.';

create index if not exists leadrocks_leads_months_at_company_idx
  on public.leadrocks_leads (months_at_company)
  where months_at_company is not null;

create index if not exists leadrocks_leads_years_at_company_bucket_idx
  on public.leadrocks_leads (years_at_company_bucket)
  where years_at_company_bucket is not null;
