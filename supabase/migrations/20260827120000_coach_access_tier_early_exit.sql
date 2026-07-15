-- Early exit: love-it-or-leave-it / guarantee opt-out (no product access).
-- Distinct from alumni (completed) and do_not_contact (relationship block).

alter table public.coaches
  drop constraint if exists coaches_access_tier_check;

alter table public.coaches
  add constraint coaches_access_tier_check
  check (
    access_tier in (
      'alumni',
      'programme',
      'core',
      'premium',
      'vip',
      'early_exit',
      'do_not_contact'
    )
  );

alter table public.community_staff_snapshot
  drop constraint if exists community_staff_snapshot_access_tier_check;

alter table public.community_staff_snapshot
  add constraint community_staff_snapshot_access_tier_check
  check (
    access_tier in (
      'alumni',
      'programme',
      'core',
      'premium',
      'vip',
      'early_exit',
      'do_not_contact'
    )
  );

comment on column public.coaches.access_tier is
  'alumni | programme (first 6 months build) | core | premium | vip | early_exit | do_not_contact';

-- Programme auto-refresh must not overwrite early exits.
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
      and coalesce(c.access_tier, '') not in ('do_not_contact', 'early_exit')
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
      and coalesce(c.access_tier, '') not in ('do_not_contact', 'early_exit')
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

create or replace function public.coaches_apply_programme_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.record_kind, 'member') = 'member'
     and coalesce(new.access_tier_locked, false) = false
     and coalesce(new.access_tier, 'programme') not in ('do_not_contact', 'early_exit')
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

-- Community: early exit never has feed/calendar access (same as do_not_contact).
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
          public.current_staff_access_tier() = 'programme'
          and 'premium' = any (event_tags)
        )
      )
    );
$$;
