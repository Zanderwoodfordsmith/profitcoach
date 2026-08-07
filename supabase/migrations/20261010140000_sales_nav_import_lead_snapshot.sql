-- Snapshot of leads returned by each Sales Nav import (for History UI).

alter table public.sales_nav_import_runs
  add column if not exists lead_snapshot jsonb not null default '[]'::jsonb;

comment on column public.sales_nav_import_runs.lead_snapshot is
  'Compact lead rows from this import for History replay in Lead Finder.';
