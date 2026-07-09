-- Add do_not_contact coach access tier (manual relationship block; no product access).

alter table public.coaches
  drop constraint if exists coaches_access_tier_check;

alter table public.coaches
  add constraint coaches_access_tier_check
  check (access_tier in ('alumni', 'core', 'premium', 'vip', 'do_not_contact'));

alter table public.community_staff_snapshot
  drop constraint if exists community_staff_snapshot_access_tier_check;

alter table public.community_staff_snapshot
  add constraint community_staff_snapshot_access_tier_check
  check (access_tier in ('alumni', 'core', 'premium', 'vip', 'do_not_contact'));

-- Do not contact coaches have no community access (same as alumni).
create or replace function public.staff_has_community_access()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_community_admin()
    or (
      public.is_staff_community()
      and public.current_staff_access_tier() in ('core', 'premium', 'vip')
    );
$$;
