-- Policies that do EXISTS (SELECT 1 FROM profiles ...) to detect the current admin
-- cause infinite recursion: evaluating profiles RLS re-enters those same policies.
-- Use community_staff_snapshot (synced from profiles) instead — same as community RLS.

-- "Profiles: admin can view all" — self-referential subquery on profiles
drop policy if exists "Profiles: admin can view all" on public.profiles;

-- "Admins can read all profiles" — typically calls is_admin() that reads profiles
drop policy if exists "Admins can read all profiles" on public.profiles;

-- Single admin read policy: no SELECT from profiles
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

-- If anything else still calls is_admin(), make it snapshot-based (no profiles)
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
