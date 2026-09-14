-- Campaign audience lists: inventory (not CRM) plus one blacklist per coach.
-- Existing first-campaign / Sales Nav lists stay audience by default.

alter table public.coach_lead_lists
  add column if not exists kind text not null default 'audience';

alter table public.coach_lead_lists
  drop constraint if exists coach_lead_lists_kind_check;

alter table public.coach_lead_lists
  add constraint coach_lead_lists_kind_check
  check (kind in ('audience', 'blacklist'));

create unique index if not exists coach_lead_lists_one_blacklist_idx
  on public.coach_lead_lists (coach_id)
  where kind = 'blacklist';

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
      'manual'
    )
  );

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
      'search'
    )
  );
