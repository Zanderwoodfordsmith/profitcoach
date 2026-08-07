-- Allow Sales Navigator Apify imports as a first-class lead-list source
-- (alongside CSV upload labelled sales_nav_csv).

alter table public.coach_lead_lists
  drop constraint if exists coach_lead_lists_source_check;

alter table public.coach_lead_lists
  add constraint coach_lead_lists_source_check
  check (source in ('lead_finder', 'connections', 'sales_nav_csv', 'sales_nav', 'mixed'));

alter table public.coach_lead_list_items
  drop constraint if exists coach_lead_list_items_source_check;

alter table public.coach_lead_list_items
  add constraint coach_lead_list_items_source_check
  check (source in ('lead_finder', 'connections', 'sales_nav_csv', 'sales_nav'));
