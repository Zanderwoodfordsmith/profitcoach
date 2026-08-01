-- RLS for lesson Q&A. Requires 20260901120000_academy_lesson_guide_and_qa.sql.
-- Private lesson questions are visible to their author and admins only;
-- public ones behave like normal community posts.

drop policy if exists "Staff read community_posts" on public.community_posts;
create policy "Staff read community_posts"
  on public.community_posts for select
  to authenticated
  using (
    case
      when community_posts.post_scope = 'lesson_qa' then
        public.is_staff_community()
        and (
          community_posts.visibility = 'public'
          or community_posts.author_id = auth.uid()
          or public.is_community_admin()
        )
      else
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
    end
  );

-- Comments inherit post visibility: the subselect is filtered by the policy
-- above, so replies on a private lesson question stay hidden from other staff.
drop policy if exists "Staff read community_post_comments" on public.community_post_comments;
create policy "Staff read community_post_comments"
  on public.community_post_comments for select
  to authenticated
  using (
    public.is_staff_community()
    and exists (
      select 1
      from public.community_posts p
      where p.id = community_post_comments.post_id
    )
  );
