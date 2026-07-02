-- Membership tiers (core, premium, vip) + Stripe subscription fields.
-- Renames legacy access_tier 'pro' → 'premium'.

-- Drop tier check constraints before data migration.
alter table public.coaches
  drop constraint if exists coaches_access_tier_check;

alter table public.community_staff_snapshot
  drop constraint if exists community_staff_snapshot_access_tier_check;

update public.coaches
set access_tier = 'premium'
where access_tier = 'pro';

update public.community_staff_snapshot
set access_tier = 'premium'
where access_tier = 'pro';

alter table public.coaches
  alter column access_tier set default 'premium';

alter table public.coaches
  add constraint coaches_access_tier_check
  check (access_tier in ('alumni', 'core', 'premium', 'vip'));

alter table public.community_staff_snapshot
  alter column access_tier set default 'premium';

alter table public.community_staff_snapshot
  add constraint community_staff_snapshot_access_tier_check
  check (access_tier in ('alumni', 'core', 'premium', 'vip'));

alter table public.coaches
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text,
  add column if not exists membership_status text
    check (
      membership_status is null
      or membership_status in (
        'active',
        'trialing',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused'
      )
    ),
  add column if not exists membership_interval text
    check (membership_interval is null or membership_interval in ('month', 'year')),
  add column if not exists membership_current_period_end timestamptz,
  add column if not exists membership_cancel_at_period_end boolean not null default false;

comment on column public.coaches.stripe_customer_id is
  'Stripe Customer ID for membership billing.';
comment on column public.coaches.stripe_subscription_id is
  'Active Stripe Subscription ID for membership.';
comment on column public.coaches.membership_status is
  'Stripe subscription status mirrored from webhooks.';
comment on column public.coaches.membership_interval is
  'Billing interval: month or year.';
comment on column public.coaches.membership_current_period_end is
  'End of current billing period from Stripe.';
comment on column public.coaches.membership_cancel_at_period_end is
  'True when subscription is set to cancel at period end.';

-- Calendar default tags: replace legacy pro with core/premium/vip.
alter table public.community_calendar_events
  alter column access_tags set default '{core,premium,vip}';

update public.community_calendar_events
set access_tags = array_replace(access_tags, 'pro', 'premium')
where 'pro' = any (access_tags);

-- Tier helpers
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
    'premium'
  );
$$;

create or replace function public.staff_has_community_access()
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

create or replace function public.staff_can_read_feedback_posts()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_community_admin()
    or (
      public.is_staff_community()
      and public.current_staff_access_tier() in ('premium', 'vip')
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

-- Community: alumni cannot access feed at all.
drop policy if exists "Staff read community_posts" on public.community_posts;
create policy "Staff read community_posts"
  on public.community_posts for select
  to authenticated
  using (
    public.staff_has_community_access()
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

drop policy if exists "Staff insert own community_posts" on public.community_posts;
create policy "Staff insert own community_posts"
  on public.community_posts for insert
  to authenticated
  with check (
    public.staff_has_community_access()
    and author_id = auth.uid()
  );

drop policy if exists "Staff update community_posts" on public.community_posts;
create policy "Staff update community_posts"
  on public.community_posts for update
  to authenticated
  using (
    public.staff_has_community_access()
    and (
      author_id = auth.uid()
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

create or replace function public.sync_community_staff_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  coach_tier text := 'premium';
begin
  if tg_op = 'INSERT' then
    if new.role in ('coach', 'admin') then
      if new.role = 'coach' then
        select coalesce(c.access_tier, 'premium') into coach_tier
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
        select coalesce(c.access_tier, 'premium') into coach_tier
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
