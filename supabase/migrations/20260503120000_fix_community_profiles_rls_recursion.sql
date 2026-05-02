-- Fix "infinite recursion detected in policy for relation profiles".
-- Policies on profiles called is_staff_community(), which SELECTed profiles again under RLS.
-- Use SECURITY DEFINER + disable row_security only for the internal lookup.

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

-- Same pattern for admin checks (inline EXISTS on profiles also triggered profiles RLS).
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

grant execute on function public.is_staff_community() to authenticated;
grant execute on function public.is_community_admin() to authenticated;

drop policy if exists "Staff update community_posts" on community_posts;
create policy "Staff update community_posts"
  on community_posts for update
  to authenticated
  using (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or public.is_community_admin()
    )
  );

drop policy if exists "Staff delete community_posts" on community_posts;
create policy "Staff delete community_posts"
  on community_posts for delete
  to authenticated
  using (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or public.is_community_admin()
    )
  );

drop policy if exists "Staff update community_post_comments" on community_post_comments;
create policy "Staff update community_post_comments"
  on community_post_comments for update
  to authenticated
  using (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or public.is_community_admin()
    )
  );

drop policy if exists "Staff delete community_post_comments" on community_post_comments;
create policy "Staff delete community_post_comments"
  on community_post_comments for delete
  to authenticated
  using (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or public.is_community_admin()
    )
  );
