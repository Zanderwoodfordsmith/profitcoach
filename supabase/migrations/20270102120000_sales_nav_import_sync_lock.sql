-- Serialize client poll + cron ticks so overlapping Unipile pages cannot
-- rewind progress_count. Expired locks are stolen after 45s.

alter table public.sales_nav_import_runs
  add column if not exists sync_lock_until timestamptz;

comment on column public.sales_nav_import_runs.sync_lock_until is
  'Set while a tick is paging Unipile/Apify; null when idle. Stale locks may be stolen.';
