-- PostgreSQL: SET LOCAL is not allowed in STABLE/IMMUTABLE functions (SQLSTATE 0A000).
-- Mark helpers VOLATILE so row_security can be toggled for the internal profiles lookup.

create or replace function public.is_staff_community()
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  return exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('coach', 'admin')
  );
end;
$$;

create or replace function public.is_community_admin()
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  return exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
end;
$$;
