-- Restore admin "post/comment as impersonated coach".
-- Membership migration rewrote posts insert to author_id = auth.uid() only.
-- Comment inserts also fail when the WITH CHECK subquery on profiles is blocked;
-- use a security-definer staff check instead.

create or replace function public.staff_user_is_coach_or_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_staff_snapshot s
    where s.user_id = p_user_id
      and s.staff_role in ('coach', 'admin')
  );
$$;

revoke all on function public.staff_user_is_coach_or_admin(uuid) from public;
grant execute on function public.staff_user_is_coach_or_admin(uuid) to authenticated;

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
        and public.staff_user_is_coach_or_admin(author_id)
      )
    )
  );

drop policy if exists "Staff insert community_post_comments" on public.community_post_comments;
create policy "Staff insert community_post_comments"
  on public.community_post_comments for insert
  to authenticated
  with check (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or (
        public.is_community_admin()
        and public.staff_user_is_coach_or_admin(author_id)
      )
    )
  );
