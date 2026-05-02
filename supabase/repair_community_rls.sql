-- =============================================================================
-- COMMUNITY RLS REPAIR (run once in Supabase Dashboard → SQL Editor)
-- =============================================================================
-- If you see: infinite recursion detected in policy for relation "profiles"
-- your remote DB likely never ran migration 20260506120000 (or it failed).
-- Pushing code to GitHub does NOT apply migrations — you must execute SQL here.
--
-- After success: reload /coach/community or /admin/community.
-- Verify block at bottom should show is_staff_community reading community_staff_snapshot only.
-- =============================================================================

BEGIN;

-- (full migration body — same as migrations/20260506120000_community_staff_snapshot_break_recursion.sql)

create table if not exists public.community_staff_snapshot (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  staff_role text not null check (staff_role in ('coach', 'admin'))
);

create index if not exists community_staff_snapshot_staff_role_idx
  on public.community_staff_snapshot (staff_role);

insert into public.community_staff_snapshot (user_id, staff_role)
select id, role::text
from public.profiles
where role in ('coach', 'admin')
on conflict (user_id) do update set staff_role = excluded.staff_role;

alter table public.community_staff_snapshot enable row level security;

drop policy if exists "Read own community staff snapshot" on public.community_staff_snapshot;
create policy "Read own community staff snapshot"
  on public.community_staff_snapshot for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.community_staff_snapshot to authenticated;

create or replace function public.sync_community_staff_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    if new.role in ('coach', 'admin') then
      insert into public.community_staff_snapshot (user_id, staff_role)
      values (new.id, new.role::text)
      on conflict (user_id) do update set staff_role = excluded.staff_role;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role in ('coach', 'admin') then
      insert into public.community_staff_snapshot (user_id, staff_role)
      values (new.id, new.role::text)
      on conflict (user_id) do update set staff_role = excluded.staff_role;
    else
      delete from public.community_staff_snapshot where user_id = new.id;
    end if;
    return new;
  end if;

  return new;
end;
$fn$;

drop trigger if exists community_staff_snapshot_sync on public.profiles;
create trigger community_staff_snapshot_sync
  after insert or update of role on public.profiles
  for each row
  execute procedure public.sync_community_staff_snapshot();

create or replace function public.is_staff_community()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.community_staff_snapshot s
    where s.user_id = auth.uid()
  );
$$;

create or replace function public.is_community_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.community_staff_snapshot s
    where s.user_id = auth.uid()
      and s.staff_role = 'admin'
  );
$$;

grant execute on function public.is_staff_community() to authenticated;
grant execute on function public.is_community_admin() to authenticated;

drop policy if exists "Staff read staff profiles for community" on public.profiles;
create policy "Staff read staff profiles for community"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or (
      role in ('coach', 'admin')
      and exists (
        select 1
        from public.community_staff_snapshot s
        where s.user_id = auth.uid()
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Fix profiles admin policies that SELECT profiles (infinite recursion).
-- "Profiles: admin can view all" uses EXISTS (SELECT FROM profiles ...) — remove it.
-- "Admins can read all profiles" / is_admin() often query profiles — use snapshot.
-- -----------------------------------------------------------------------------
drop policy if exists "Profiles: admin can view all" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;

create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.community_staff_snapshot s
      where s.user_id = auth.uid()
        and s.staff_role = 'admin'
    )
  );

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.community_staff_snapshot s
    where s.user_id = auth.uid()
      and s.staff_role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- VERIFY (optional): expand results — is_staff_community must reference
-- community_staff_snapshot only (not "from profiles").
-- -----------------------------------------------------------------------------
-- SELECT pg_get_functiondef('public.is_staff_community()'::regprocedure);
