-- Coach access tiers: alumni, pro, premium — gates nav, community channels, calendar visibility.

alter table public.coaches
  add column if not exists access_tier text not null default 'pro'
    check (access_tier in ('alumni', 'pro', 'premium')),
  add column if not exists access_tier_locked boolean not null default false;

update public.coaches
set access_tier = 'pro'
where record_kind = 'member' or record_kind is null;

alter table public.community_calendar_events
  add column if not exists access_tags text[] not null default '{alumni,pro,premium}';

alter table public.community_staff_snapshot
  add column if not exists access_tier text not null default 'pro'
    check (access_tier in ('alumni', 'pro', 'premium'));

-- Backfill snapshot tiers from coaches (admins default to pro).
update public.community_staff_snapshot s
set access_tier = coalesce(c.access_tier, 'pro')
from public.coaches c
where c.id = s.user_id
  and s.staff_role = 'coach';

-- Helper: current user's access tier from snapshot (never reads profiles/coaches in RLS).
create or replace function public.current_staff_access_tier()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select s.access_tier
      from public.community_staff_snapshot s
      where s.user_id = auth.uid()
    ),
    'pro'
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
      and public.current_staff_access_tier() = any (event_tags)
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
      and public.current_staff_access_tier() <> 'alumni'
    );
$$;

-- Sync access_tier from coaches into community_staff_snapshot.
create or replace function public.sync_coach_access_tier_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    update public.community_staff_snapshot
    set access_tier = new.access_tier
    where user_id = new.id;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.access_tier is distinct from old.access_tier then
    update public.community_staff_snapshot
    set access_tier = new.access_tier
    where user_id = new.id;
    return new;
  end if;

  return new;
end;
$fn$;

drop trigger if exists coaches_sync_access_tier_snapshot on public.coaches;
create trigger coaches_sync_access_tier_snapshot
  after insert or update of access_tier on public.coaches
  for each row
  execute procedure public.sync_coach_access_tier_snapshot();

-- Ensure new coach rows get snapshot tier on profile sync (extend existing trigger path).
create or replace function public.sync_community_staff_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  coach_tier text := 'pro';
begin
  if tg_op = 'INSERT' then
    if new.role in ('coach', 'admin') then
      if new.role = 'coach' then
        select coalesce(c.access_tier, 'pro') into coach_tier
        from public.coaches c
        where c.id = new.id;
      end if;
      insert into public.community_staff_snapshot (user_id, staff_role, access_tier)
      values (new.id, new.role::text, coach_tier)
      on conflict (user_id) do update
        set staff_role = excluded.staff_role,
            access_tier = excluded.access_tier;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role in ('coach', 'admin') then
      if new.role = 'coach' then
        select coalesce(c.access_tier, 'pro') into coach_tier
        from public.coaches c
        where c.id = new.id;
      else
        coach_tier := 'pro';
      end if;
      insert into public.community_staff_snapshot (user_id, staff_role, access_tier)
      values (new.id, new.role::text, coach_tier)
      on conflict (user_id) do update
        set staff_role = excluded.staff_role,
            access_tier = excluded.access_tier;
    else
      delete from public.community_staff_snapshot where user_id = new.id;
    end if;
    return new;
  end if;

  return new;
end;
$fn$;

-- Calendar: tier-aware read policy.
drop policy if exists "Staff read community_calendar_events" on public.community_calendar_events;
create policy "Staff read community_calendar_events"
  on public.community_calendar_events for select
  to authenticated
  using (public.staff_can_read_calendar_event(access_tags));

-- Posts: alumni cannot read feedback-request channel posts.
drop policy if exists "Staff read community_posts" on public.community_posts;
create policy "Staff read community_posts"
  on public.community_posts for select
  to authenticated
  using (
    public.is_staff_community()
    and (
      public.staff_can_read_feedback_posts()
      or not exists (
        select 1
        from public.community_categories cat
        where cat.id = community_posts.category_id
          and cat.slug = 'requesting-feedback'
      )
    )
  );
