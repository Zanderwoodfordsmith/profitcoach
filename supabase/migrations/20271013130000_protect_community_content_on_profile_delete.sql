-- Posts, comments, support replies and staff ticket notes are read by other
-- people. Deleting the person who wrote them used to delete them too. Now the
-- database refuses to delete a profile that still has any of these (NO ACTION,
-- checked at the end of the statement so other cascades still run). When
-- someone leaves, remove their login and contact details and keep the profile
-- for their name and avatar.

alter table public.community_posts
  drop constraint if exists community_posts_author_id_fkey,
  add constraint community_posts_author_id_fkey
    foreign key (author_id) references public.profiles (id);

alter table public.community_post_comments
  drop constraint if exists community_post_comments_author_id_fkey,
  add constraint community_post_comments_author_id_fkey
    foreign key (author_id) references public.profiles (id);

alter table public.community_feedback_replies
  drop constraint if exists community_feedback_replies_created_by_fkey,
  add constraint community_feedback_replies_created_by_fkey
    foreign key (created_by) references public.profiles (id);

alter table public.support_ticket_internal_notes
  drop constraint if exists support_ticket_internal_notes_created_by_fkey,
  add constraint support_ticket_internal_notes_created_by_fkey
    foreign key (created_by) references public.profiles (id);

-- Support tickets outlive the member who opened them, like tickets from the
-- public support form (created_by is already nullable).
alter table public.community_feedback_reports
  drop constraint if exists community_feedback_reports_created_by_fkey,
  add constraint community_feedback_reports_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;
