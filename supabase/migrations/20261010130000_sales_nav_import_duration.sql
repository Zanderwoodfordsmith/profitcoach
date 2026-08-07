-- Wall-clock duration for Sales Nav import requests (scrape + cache upsert).

alter table public.sales_nav_import_runs
  add column if not exists duration_ms integer;

comment on column public.sales_nav_import_runs.duration_ms is
  'Milliseconds from request start through scrape + cache upsert (null for legacy rows).';

create index if not exists sales_nav_import_runs_duration_ms_idx
  on public.sales_nav_import_runs (duration_ms)
  where duration_ms is not null;
