-- Lesson Guide tab (long-form written content) + lesson Q&A on community_posts.
-- Schema only. RLS lives in 20260901130000_academy_lesson_qa_rls.sql so a policy
-- failure cannot roll back these columns.

-- ---------------------------------------------------------------------------
-- Academy lesson content: guide markdown (Overview remains body_markdown)
-- ---------------------------------------------------------------------------
alter table public.academy_lesson_content
  add column if not exists guide_markdown text;

comment on column public.academy_lesson_content.guide_markdown is
  'Optional longer written guide / SOP for the Guide tab. Overview stays in body_markdown.';

comment on column public.academy_lesson_content.body_markdown is
  'Short Overview tab content (what this is / why it matters).';

-- ---------------------------------------------------------------------------
-- Community posts: lesson-scoped Q&A (same post/comment structure as the feed)
-- ---------------------------------------------------------------------------
alter table public.community_posts
  add column if not exists post_scope text not null default 'feed';

alter table public.community_posts
  add column if not exists visibility text not null default 'public';

alter table public.community_posts
  add column if not exists lesson_course_id text;

alter table public.community_posts
  add column if not exists lesson_id text;

alter table public.community_posts
  add column if not exists lesson_path text;

comment on column public.community_posts.post_scope is
  'feed = community feed; lesson_qa = question attached to an academy lesson.';

comment on column public.community_posts.visibility is
  'public = all staff can see (for lesson_qa); private = author + admins only.';

comment on column public.community_posts.lesson_path is
  'App path to the lesson when the question was asked (for notification deep links).';

alter table public.community_posts
  drop constraint if exists community_posts_post_scope_check;
alter table public.community_posts
  add constraint community_posts_post_scope_check
  check (post_scope in ('feed', 'lesson_qa'));

alter table public.community_posts
  drop constraint if exists community_posts_visibility_check;
alter table public.community_posts
  add constraint community_posts_visibility_check
  check (visibility in ('public', 'private'));

alter table public.community_posts
  drop constraint if exists community_posts_lesson_qa_keys;
alter table public.community_posts
  add constraint community_posts_lesson_qa_keys
  check (
    (post_scope = 'feed' and lesson_id is null)
    or (
      post_scope = 'lesson_qa'
      and lesson_id is not null
      and lesson_course_id is not null
    )
  );

create index if not exists community_posts_lesson_qa_idx
  on public.community_posts (lesson_id, created_at desc)
  where post_scope = 'lesson_qa';

create index if not exists community_posts_feed_scope_idx
  on public.community_posts (post_scope, is_pinned desc, created_at desc);

-- Public lesson questions land in the existing feedback channel, relabelled Q&A.
-- Slug stays the same so access gates and app code keep working.
update public.community_categories
set label = '❓ Q&A'
where slug = 'requesting-feedback';
