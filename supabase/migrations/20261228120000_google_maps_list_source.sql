-- Allow Google Maps as a list-level source (items already allow google_maps).

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
      'google_maps'
    )
  );
