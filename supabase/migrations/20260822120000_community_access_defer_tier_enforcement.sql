-- Align community RLS with app ENFORCE_MEMBERSHIP_TIERS (default off).
-- The membership migration gated feed/calendar on access_tier immediately, but the
-- app still treats every coach as Premium until launch. Alumni/core backfills then
-- blocked coaches from reading/posting even though product enforcement is off.
--
-- When flipping ENFORCE_MEMBERSHIP_TIERS=true in the app, also:
--   update public.app_runtime_flags
--   set value = '{"enabled": true}'::jsonb, updated_at = now()
--   where key = 'enforce_membership_tiers';

create table if not exists public.app_runtime_flags (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_runtime_flags enable row level security;

insert into public.app_runtime_flags (key, value)
values ('enforce_membership_tiers', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;

create or replace function public.membership_tier_enforcement_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (f.value->>'enabled')::boolean
      from public.app_runtime_flags f
      where f.key = 'enforce_membership_tiers'
    ),
    false
  );
$$;

revoke all on function public.membership_tier_enforcement_enabled() from public;
grant execute on function public.membership_tier_enforcement_enabled() to authenticated;

-- Repair: ensure every coach/admin has a snapshot row (missing rows fail is_staff_community).
insert into public.community_staff_snapshot (user_id, staff_role, access_tier)
select
  p.id,
  p.role::text,
  case
    when p.role = 'admin' then 'premium'
    else coalesce(nullif(c.access_tier, ''), 'premium')
  end
from public.profiles p
left join public.coaches c on c.id = p.id
where p.role in ('coach', 'admin')
on conflict (user_id) do update
  set staff_role = excluded.staff_role,
      access_tier = coalesce(
        nullif(excluded.access_tier, ''),
        community_staff_snapshot.access_tier,
        'premium'
      );

create or replace function public.staff_has_community_access()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_community_admin()
    or (
      public.is_staff_community()
      and public.current_staff_access_tier() is distinct from 'do_not_contact'
      and (
        not public.membership_tier_enforcement_enabled()
        or public.current_staff_access_tier() in ('core', 'premium', 'vip')
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
      and public.current_staff_access_tier() is distinct from 'do_not_contact'
      and (
        not public.membership_tier_enforcement_enabled()
        -- Until launch: Premium-equivalent (feedback channel included).
        or public.current_staff_access_tier() in ('premium', 'vip')
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
      and public.current_staff_access_tier() is distinct from 'do_not_contact'
      and (
        not public.membership_tier_enforcement_enabled()
        or public.current_staff_access_tier() = any (event_tags)
      )
    );
$$;

-- Restore admin “post as coach” insert check lost in membership migration.
drop policy if exists "Staff insert own community_posts" on public.community_posts;
create policy "Staff insert own community_posts"
  on public.community_posts for insert
  to authenticated
  with check (
    public.staff_has_community_access()
    and (
      author_id = auth.uid()
      or (
        public.is_community_admin()
        and exists (
          select 1
          from public.profiles p
          where p.id = author_id
            and p.role in ('coach', 'admin')
        )
      )
    )
  );

-- Keep access gate + restore admin-only pinning on update.
drop policy if exists "Staff update community_posts" on public.community_posts;
create policy "Staff update community_posts"
  on public.community_posts for update
  to authenticated
  using (
    public.staff_has_community_access()
    and (
      author_id = auth.uid()
      or public.is_community_admin()
    )
  )
  with check (
    public.staff_has_community_access()
    and (
      public.is_community_admin()
      or (
        author_id = auth.uid()
        and is_pinned is not distinct from (
          select cp.is_pinned
          from public.community_posts cp
          where cp.id = community_posts.id
        )
      )
    )
  );
