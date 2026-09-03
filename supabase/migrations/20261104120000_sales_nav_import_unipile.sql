-- Parallel Unipile Sales Nav imports (keep Apify). Cursor-paginated jobs
-- share sales_nav_import_runs so History / cache / CSV stay the same.

alter table public.sales_nav_import_runs
  add column if not exists provider text not null default 'apify';

alter table public.sales_nav_import_runs
  drop constraint if exists sales_nav_import_runs_provider_check;

alter table public.sales_nav_import_runs
  add constraint sales_nav_import_runs_provider_check
  check (provider in ('apify', 'unipile'));

alter table public.sales_nav_import_runs
  add column if not exists unipile_account_id text;

alter table public.sales_nav_import_runs
  add column if not exists unipile_cursor text;

comment on column public.sales_nav_import_runs.provider is
  'apify (cookie scrape) or unipile (connected LinkedIn session).';

comment on column public.sales_nav_import_runs.unipile_cursor is
  'Next Unipile search cursor; null/empty means first page or complete.';
