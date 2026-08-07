-- Audit log for Sales Navigator Apify scrapes → shared lead cache.

create table if not exists public.sales_nav_import_runs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  sales_nav_url text,
  take_pages integer,
  scraped_count integer not null default 0,
  cache_inserted integer not null default 0,
  cache_updated integer not null default 0,
  cache_skipped integer not null default 0,
  saved_to_list boolean not null default false,
  list_id uuid references public.coach_lead_lists (id) on delete set null,
  profile_scraper_mode text not null default 'Short',
  /** Apify pay-per-event estimate for Short = take_pages × $0.002 */
  estimated_cost_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sales_nav_import_runs_created_at_idx
  on public.sales_nav_import_runs (created_at desc);

create index if not exists sales_nav_import_runs_coach_id_idx
  on public.sales_nav_import_runs (coach_id);

alter table public.sales_nav_import_runs enable row level security;

drop policy if exists "Admins read sales nav import runs"
  on public.sales_nav_import_runs;
create policy "Admins read sales nav import runs"
  on public.sales_nav_import_runs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
