-- Allow community admins to insert posts/comments as another coach/admin (UI: admin “view as coach”).
-- Without this, author_id must equal auth.uid() and impersonation only changes chrome, not Supabase auth.

drop policy if exists "Staff insert own community_posts" on public.community_posts;
create policy "Staff insert own community_posts"
  on public.community_posts for insert
  to authenticated
  with check (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or (
        public.is_community_admin()
        and exists (
          select 1 from public.profiles p
          where p.id = author_id
            and p.role in ('coach', 'admin')
        )
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
        and exists (
          select 1 from public.profiles p
          where p.id = author_id
            and p.role in ('coach', 'admin')
        )
      )
    )
  );
