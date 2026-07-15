-- Programme access tier: Premium-equivalent features for the first 6 months
-- after join date (profiles.disco_community_joined_on, else profiles.created_at).
-- Auto-refreshes on coach insert, join-date change, and daily (pg_cron when available).

-- ---------------------------------------------------------------------------
-- Runtime flags + enforcement helper (must exist before community RLS helpers)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Constraints + default
-- ---------------------------------------------------------------------------
alter table public.coaches
  drop constraint if exists coaches_access_tier_check;

alter table public.coaches
  add constraint coaches_access_tier_check
  check (access_tier in ('alumni', 'programme', 'core', 'premium', 'vip', 'do_not_contact'));

alter table public.community_staff_snapshot
  drop constraint if exists community_staff_snapshot_access_tier_check;

alter table public.community_staff_snapshot
  add constraint community_staff_snapshot_access_tier_check
  check (access_tier in ('alumni', 'programme', 'core', 'premium', 'vip', 'do_not_contact'));

alter table public.coaches
  alter column access_tier set default 'programme';

alter table public.community_staff_snapshot
  alter column access_tier set default 'programme';

comment on column public.coaches.access_tier is
  'alumni | programme (first 6 months build) | core | premium | vip | do_not_contact';

-- ---------------------------------------------------------------------------
-- Join date helper (mirrors resolveCoachJoinedAt in app)
-- ---------------------------------------------------------------------------
create or replace function public.coach_resolved_join_at(p_coach_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case
      when p.disco_community_joined_on is not null
        then (p.disco_community_joined_on::timestamp at time zone 'utc')
      else null
    end,
    case
      when c.slug is not null and lower(c.slug) = 'profit-coach-snapshot' then null
      else p.created_at
    end
  )
  from public.coaches c
  join public.profiles p on p.id = c.id
  where c.id = p_coach_id;
$$;

revoke all on function public.coach_resolved_join_at(uuid) from public;
grant execute on function public.coach_resolved_join_at(uuid) to authenticated;
grant execute on function public.coach_resolved_join_at(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Refresh programme / first_6_months from join date
-- ---------------------------------------------------------------------------
create or replace function public.refresh_coach_programme_status(p_coach_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - interval '6 months';
  updated_count integer := 0;
  n integer;
begin
  -- Enter / stay on programme while within first 6 months of join.
  with targets as (
    select c.id
    from public.coaches c
    join public.profiles p on p.id = c.id
    where (p_coach_id is null or c.id = p_coach_id)
      and coalesce(c.record_kind, 'member') = 'member'
      and coalesce(c.access_tier_locked, false) = false
      and coalesce(c.access_tier, '') is distinct from 'do_not_contact'
      and coalesce(c.recurring_payment_status, '') is distinct from 'complimentary'
      and coalesce(c.membership_status, '') not in ('active', 'trialing', 'past_due')
      and public.coach_resolved_join_at(c.id) is not null
      and public.coach_resolved_join_at(c.id) > cutoff
      and (
        c.access_tier is distinct from 'programme'
        or c.recurring_payment_status is distinct from 'first_6_months'
      )
  )
  update public.coaches c
  set
    access_tier = 'programme',
    recurring_payment_status = 'first_6_months'
  from targets t
  where c.id = t.id;
  get diagnostics n = row_count;
  updated_count := updated_count + coalesce(n, 0);

  -- Leave programme when build window ends (no Stripe / complimentary / lock).
  with targets as (
    select c.id
    from public.coaches c
    where (p_coach_id is null or c.id = p_coach_id)
      and coalesce(c.record_kind, 'member') = 'member'
      and coalesce(c.access_tier_locked, false) = false
      and coalesce(c.access_tier, '') is distinct from 'do_not_contact'
      and coalesce(c.recurring_payment_status, '') is distinct from 'complimentary'
      and coalesce(c.membership_status, '') not in ('active', 'trialing', 'past_due')
      and c.access_tier = 'programme'
      and (
        public.coach_resolved_join_at(c.id) is null
        or public.coach_resolved_join_at(c.id) <= cutoff
      )
  )
  update public.coaches c
  set
    access_tier = 'alumni',
    recurring_payment_status = case
      when c.recurring_payment_status = 'first_6_months' then null
      else c.recurring_payment_status
    end
  from targets t
  where c.id = t.id;
  get diagnostics n = row_count;
  updated_count := updated_count + coalesce(n, 0);

  -- Clear stale first_6_months when past window but tier was changed away from programme.
  with targets as (
    select c.id
    from public.coaches c
    where (p_coach_id is null or c.id = p_coach_id)
      and coalesce(c.access_tier_locked, false) = false
      and coalesce(c.membership_status, '') not in ('active', 'trialing', 'past_due')
      and c.recurring_payment_status = 'first_6_months'
      and c.access_tier is distinct from 'programme'
      and (
        public.coach_resolved_join_at(c.id) is null
        or public.coach_resolved_join_at(c.id) <= cutoff
      )
  )
  update public.coaches c
  set recurring_payment_status = null
  from targets t
  where c.id = t.id;
  get diagnostics n = row_count;
  updated_count := updated_count + coalesce(n, 0);

  return updated_count;
end;
$$;

revoke all on function public.refresh_coach_programme_status(uuid) from public;
grant execute on function public.refresh_coach_programme_status(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Triggers: new coaches + join-date edits
-- ---------------------------------------------------------------------------
create or replace function public.coaches_apply_programme_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Defaults for new member rows (skip if already locked / historical / complimentary).
  if coalesce(new.record_kind, 'member') = 'member'
     and coalesce(new.access_tier_locked, false) = false
     and coalesce(new.access_tier, 'programme') is distinct from 'do_not_contact'
     and coalesce(new.recurring_payment_status, '') is distinct from 'complimentary'
  then
    new.access_tier := coalesce(nullif(new.access_tier, ''), 'programme');
    if new.access_tier = 'programme' then
      new.recurring_payment_status := coalesce(
        new.recurring_payment_status,
        'first_6_months'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists coaches_apply_programme_on_insert on public.coaches;
create trigger coaches_apply_programme_on_insert
  before insert on public.coaches
  for each row
  execute procedure public.coaches_apply_programme_on_insert();

create or replace function public.profiles_refresh_coach_programme_on_join_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.disco_community_joined_on is distinct from old.disco_community_joined_on
       or new.created_at is distinct from old.created_at
     )
  then
    perform public.refresh_coach_programme_status(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_refresh_coach_programme_on_join_change on public.profiles;
create trigger profiles_refresh_coach_programme_on_join_change
  after update of disco_community_joined_on, created_at on public.profiles
  for each row
  execute procedure public.profiles_refresh_coach_programme_on_join_change();

-- After coach insert, recompute from join date (profile may already exist).
create or replace function public.coaches_refresh_programme_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_coach_programme_status(new.id);
  return new;
end;
$$;

drop trigger if exists coaches_refresh_programme_after_insert on public.coaches;
create trigger coaches_refresh_programme_after_insert
  after insert on public.coaches
  for each row
  execute procedure public.coaches_refresh_programme_after_insert();

-- ---------------------------------------------------------------------------
-- Community RLS: programme = Premium-equivalent
-- Enforcement check is inlined (no function call) so this is safe even if the
-- helper above was not applied yet in a partial SQL-editor run.
-- ---------------------------------------------------------------------------
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
        not coalesce(
          (
            select (f.value->>'enabled')::boolean
            from public.app_runtime_flags f
            where f.key = 'enforce_membership_tiers'
          ),
          false
        )
        or public.current_staff_access_tier() in (
          'programme', 'core', 'premium', 'vip'
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
      and public.current_staff_access_tier() is distinct from 'do_not_contact'
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
          'programme', 'premium', 'vip'
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
      and public.current_staff_access_tier() is distinct from 'do_not_contact'
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
        -- Programme uses Premium calendar access without a separate event tag.
        or (
          public.current_staff_access_tier() = 'programme'
          and 'premium' = any (event_tags)
        )
      )
    );
$$;

-- Keep staff snapshot defaults aligned with programme signup.
create or replace function public.sync_community_staff_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  coach_tier text := 'programme';
begin
  if tg_op = 'INSERT' then
    if new.role in ('coach', 'admin') then
      if new.role = 'coach' then
        select coalesce(c.access_tier, 'programme') into coach_tier
        from public.coaches c
        where c.id = new.id;
      else
        coach_tier := 'premium';
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
        select coalesce(c.access_tier, 'programme') into coach_tier
        from public.coaches c
        where c.id = new.id;
      else
        coach_tier := 'premium';
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

-- ---------------------------------------------------------------------------
-- One-shot backfill + optional daily cron
-- ---------------------------------------------------------------------------
select public.refresh_coach_programme_status(null);

do $cron$
begin
  if exists (
    select 1 from information_schema.schemata where schema_name = 'cron'
  ) then
    begin
      perform cron.unschedule(j.jobid)
      from cron.job j
      where j.jobname = 'refresh-coach-programme-status';
    exception
      when undefined_table then null;
      when others then null;
    end;

    perform cron.schedule(
      'refresh-coach-programme-status',
      '20 4 * * *',
      $job$select public.refresh_coach_programme_status(null)$job$
    );
  end if;
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', SQLERRM;
end
$cron$;
