-- Background Sales Nav import jobs: status + Apify run tracking.
-- Existing rows are completed history → status = 'succeeded'.

alter table public.sales_nav_import_runs
  add column if not exists status text not null default 'succeeded',
  add column if not exists apify_run_id text,
  add column if not exists apify_dataset_id text,
  add column if not exists progress_count integer not null default 0,
  add column if not exists error_message text,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

alter table public.sales_nav_import_runs
  drop constraint if exists sales_nav_import_runs_status_check;

alter table public.sales_nav_import_runs
  add constraint sales_nav_import_runs_status_check
  check (status in ('pending', 'running', 'succeeded', 'failed'));

update public.sales_nav_import_runs
set
  started_at = coalesce(started_at, created_at),
  finished_at = coalesce(finished_at, created_at)
where status = 'succeeded'
  and (started_at is null or finished_at is null);

create index if not exists sales_nav_import_runs_status_idx
  on public.sales_nav_import_runs (status)
  where status in ('pending', 'running');

notify pgrst, 'reload schema';
