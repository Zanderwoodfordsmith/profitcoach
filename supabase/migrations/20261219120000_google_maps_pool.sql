-- Google Maps pool import: identity beyond LinkedIn, plus background Apify jobs.

alter table public.coach_lead_list_items
  add column if not exists place_id text,
  add column if not exists website text,
  add column if not exists identity_key text;

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
      'google_maps'
    )
  );

update public.coach_lead_list_items
set identity_key = 'li:' || linkedin_url
where identity_key is null
  and linkedin_url is not null
  and btrim(linkedin_url) <> '';

create unique index if not exists coach_lead_list_items_list_identity_key_uidx
  on public.coach_lead_list_items (list_id, identity_key)
  where identity_key is not null;

create index if not exists coach_lead_list_items_list_place_id_idx
  on public.coach_lead_list_items (list_id, place_id)
  where place_id is not null;

create table if not exists public.google_maps_import_runs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  list_id uuid references public.coach_lead_lists (id) on delete set null,
  kind text not null default 'search'
    check (kind in ('search', 'find_person')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  search_term text,
  location_query text,
  max_places integer,
  find_people boolean not null default false,
  skip_closed boolean not null default true,
  scrape_contacts boolean not null default true,
  place_ids jsonb not null default '[]'::jsonb,
  item_ids jsonb not null default '[]'::jsonb,
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

create index if not exists google_maps_import_runs_coach_id_idx
  on public.google_maps_import_runs (coach_id, created_at desc);

create index if not exists google_maps_import_runs_status_idx
  on public.google_maps_import_runs (status)
  where status in ('pending', 'running');

alter table public.google_maps_import_runs enable row level security;

drop policy if exists "Coaches select own google maps import runs"
  on public.google_maps_import_runs;
create policy "Coaches select own google maps import runs"
  on public.google_maps_import_runs
  for select
  to authenticated
  using (coach_id = auth.uid());

comment on table public.google_maps_import_runs is
  'Coach-owned Google Maps Apify jobs (search import or find-person enrichment).';

comment on column public.coach_lead_list_items.identity_key is
  'Stable pool dedupe key: li:/in/ URL, g:Place ID, em:email, ph:phone, or ws:website.';

comment on column public.coach_lead_list_items.place_id is
  'Google Maps Place ID (ChIJ…), used to enrich a business row later.';

notify pgrst, 'reload schema';
