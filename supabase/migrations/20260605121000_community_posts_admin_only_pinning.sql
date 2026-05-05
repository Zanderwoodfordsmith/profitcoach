-- Restrict community post pinning to admins only.
-- Authors can still edit their posts, but cannot change is_pinned.

drop policy if exists "Staff update community_posts" on public.community_posts;

create policy "Staff update community_posts"
  on public.community_posts
  for update
  to authenticated
  using (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
    )
  )
  with check (
    public.is_staff_community()
    and (
      exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
      or (
        author_id = auth.uid()
        and is_pinned is not distinct from (
          select cp.is_pinned
          from public.community_posts cp
          where cp.id = community_posts.id
        )
      )
    )
  );
