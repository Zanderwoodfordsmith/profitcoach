-- Coach-requested pages vs Apify over-fetch pages (cost = take_pages).

alter table public.sales_nav_import_runs
  add column if not exists requested_take_pages integer;

comment on column public.sales_nav_import_runs.requested_take_pages is
  'Pages the coach asked for (25 leads/page). take_pages is what we sent Apify (may be ~25% higher).';

update public.sales_nav_import_runs
set requested_take_pages = take_pages
where requested_take_pages is null
  and take_pages is not null;

notify pgrst, 'reload schema';
