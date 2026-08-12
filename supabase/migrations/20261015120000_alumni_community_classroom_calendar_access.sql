-- Temporary: alumni (no paid membership) keep community feed, Ask & Share,
-- and calendar access while membership gating is otherwise on.
-- early_exit / do_not_contact stay locked out.

create or replace function public.staff_has_community_access()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_community_admin()
    or (
      public.is_staff_community()
      and public.current_staff_access_tier() not in ('do_not_contact', 'early_exit')
      and (
        not coalesce(
          (
            select (f.value->>'enabled')::boolean
            from public.app_runtime_flags f
            where f.key = 'enforce_membership_tiers'
          ),
          false
        )
        or public.current_staff_access_tier() in (
          'alumni', 'programme', 'core', 'premium', 'vip'
        )
      )
    );
$$;

create or replace function public.staff_can_read_feedback_posts()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_community_admin()
    or (
      public.is_staff_community()
      and public.current_staff_access_tier() not in ('do_not_contact', 'early_exit')
      and (
        not coalesce(
          (
            select (f.value->>'enabled')::boolean
            from public.app_runtime_flags f
            where f.key = 'enforce_membership_tiers'
          ),
          false
        )
        or public.current_staff_access_tier() in (
          'alumni', 'programme', 'core', 'premium', 'vip'
        )
      )
    );
$$;

create or replace function public.staff_can_read_calendar_event(event_tags text[])
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_community_admin()
    or (
      public.is_staff_community()
      and public.current_staff_access_tier() not in ('do_not_contact', 'early_exit')
      and (
        not coalesce(
          (
            select (f.value->>'enabled')::boolean
            from public.app_runtime_flags f
            where f.key = 'enforce_membership_tiers'
          ),
          false
        )
        or public.current_staff_access_tier() = any (event_tags)
        or (
          public.current_staff_access_tier() in ('programme', 'alumni')
          and 'premium' = any (event_tags)
        )
      )
    );
$$;
