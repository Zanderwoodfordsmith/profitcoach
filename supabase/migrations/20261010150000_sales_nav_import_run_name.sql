alter table public.sales_nav_import_runs
  add column if not exists name text;

comment on column public.sales_nav_import_runs.name is
  'Optional display name for this import (Lead Finder History / admin table).';
