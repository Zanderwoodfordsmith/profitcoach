-- Stop infinite recursion on profiles: is_staff_community() must read profiles without
-- re-entering profiles RLS. SET LOCAL row_security is unreliable in some contexts;
-- SECURITY DEFINER owned by postgres bypasses RLS on inner SELECT (superuser).

create or replace function public.is_staff_community()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('coach', 'admin')
  );
$$;

create or replace function public.is_community_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

alter function public.is_staff_community() owner to postgres;
alter function public.is_community_admin() owner to postgres;

grant execute on function public.is_staff_community() to authenticated;
grant execute on function public.is_community_admin() to authenticated;
