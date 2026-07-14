-- Per-admin order for coach table view tabs (All stays pinned first in app logic).

alter table public.admin_coach_table_view_preferences
  add column if not exists view_order uuid[] not null default '{}'::uuid[];

-- Ensure any existing All / All coaches row is shared with every admin.
update public.admin_coach_table_views
set
  name = 'All',
  is_private = false,
  updated_at = now()
where lower(trim(name)) in ('all', 'all coaches');
