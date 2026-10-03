-- Google Search pool import (apify/google-search-scraper), alongside Maps.

alter table public.coach_lead_list_items
  drop constraint if exists coach_lead_list_items_source_check;

alter table public.coach_lead_list_items
  add constraint coach_lead_list_items_source_check
  check (
    source in (
      'lead_finder',
      'connections',
      'sales_nav_csv',
      'sales_nav',
      'manual',
      'search',
      'google_maps',
      'google_search'
    )
  );

alter table public.coach_lead_lists
  drop constraint if exists coach_lead_lists_source_check;

alter table public.coach_lead_lists
  add constraint coach_lead_lists_source_check
  check (
    source in (
      'lead_finder',
      'connections',
      'sales_nav_csv',
      'sales_nav',
      'mixed',
      'manual',
      'search',
      'google_maps',
      'google_search'
    )
  );

create table if not exists public.google_search_import_runs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  list_id uuid references public.coach_lead_lists (id) on delete set null,
  save_list_id uuid references public.coach_lead_lists (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  search_term text,
  location_query text,
  country_code text,
  max_results integer,
  find_people boolean not null default true,
  apify_run_id text,
  apify_dataset_id text,
  scraped_count integer not null default 0,
  progress_count integer not null default 0,
  added_count integer not null default 0,
  skipped_count integer not null default 0,
  people_found integer not null default 0,
  estimated_cost_usd numeric(10, 4) not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists google_search_import_runs_coach_id_idx
  on public.google_search_import_runs (coach_id, created_at desc);

create index if not exists google_search_import_runs_status_idx
  on public.google_search_import_runs (status)
  where status in ('pending', 'running');

alter table public.google_search_import_runs enable row level security;

drop policy if exists "Coaches select own google search import runs"
  on public.google_search_import_runs;
create policy "Coaches select own google search import runs"
  on public.google_search_import_runs
  for select
  to authenticated
  using (coach_id = auth.uid());

comment on table public.google_search_import_runs is
  'Coach-owned Google Search Apify jobs. Organic business sites, with the same owner lookup Maps uses.';

notify pgrst, 'reload schema';
