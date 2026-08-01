-- Catch-up script: academy migrations from 2026-08-28 onward, concatenated in order.
-- Every statement is idempotent, so re-running is safe.
-- Source of truth stays supabase/migrations/ — this file is a convenience for the
-- Supabase SQL Editor when the CLI is unavailable.

-- ===========================================================================
-- 20260828120000_academy_lesson_content_duration.sql
-- ===========================================================================
-- Sidebar lesson length (e.g. "6m"), editable with video/body in the admin lesson editor.
alter table public.academy_lesson_content
  add column if not exists duration text;

comment on column public.academy_lesson_content.duration is
  'Optional display duration override (e.g. 6m); merged over hub/catalog duration.';

-- ===========================================================================
-- 20260831120000_academy_lesson_views.sql
-- ===========================================================================
-- Per-coach last-opened lesson timestamps for Resume Training.

create table if not exists public.academy_lesson_views (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);

comment on table public.academy_lesson_views is
  'Last time a coach opened a lesson; used by Resume Training (independent of completion ticks).';

create index if not exists academy_lesson_views_user_recent_idx
  on public.academy_lesson_views (user_id, viewed_at desc);

create index if not exists academy_lesson_views_user_course_idx
  on public.academy_lesson_views (user_id, course_id);

alter table public.academy_lesson_views enable row level security;

-- ===========================================================================
-- 20260901120000_academy_lesson_guide_and_qa.sql
-- ===========================================================================
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

-- ===========================================================================
-- 20260901130000_academy_lesson_qa_rls.sql
-- ===========================================================================
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

-- ===========================================================================
-- 20260901140000_ask_and_share_category_label.sql
-- ===========================================================================
-- Relabel the requesting-feedback / Q&A community channel to Ask & Share.
-- Slug stays `requesting-feedback` so access gates and app code keep working.

update public.community_categories
set label = '🗣️ Ask & Share'
where slug = 'requesting-feedback';

-- ===========================================================================
-- 20260901150000_academy_lesson_actions.sql
-- ===========================================================================
-- Recommended lesson actions (Overview right column) + My Actions provenance.

-- ---------------------------------------------------------------------------
-- Academy lesson content: curated action checklist
-- ---------------------------------------------------------------------------
alter table public.academy_lesson_content
  add column if not exists recommended_actions jsonb not null default '[]'::jsonb;

comment on column public.academy_lesson_content.recommended_actions is
  'JSON array of { id, text } recommended next steps shown on the Overview tab.';

alter table public.academy_lesson_content
  drop constraint if exists academy_lesson_content_recommended_actions_is_array;
alter table public.academy_lesson_content
  add constraint academy_lesson_content_recommended_actions_is_array
  check (jsonb_typeof(recommended_actions) = 'array');

-- ---------------------------------------------------------------------------
-- Coach action items: link personal actions back to an academy lesson
-- ---------------------------------------------------------------------------
alter table public.coach_action_items
  add column if not exists academy_course_id text;

alter table public.coach_action_items
  add column if not exists academy_lesson_id text;

alter table public.coach_action_items
  add column if not exists academy_recommended_action_id text;

comment on column public.coach_action_items.academy_course_id is
  'When set, this item was created from an academy lesson (My Actions).';

comment on column public.coach_action_items.academy_lesson_id is
  'Academy lesson id when created from lesson Overview actions.';

comment on column public.coach_action_items.academy_recommended_action_id is
  'Matches recommended_actions[].id when this row tracks a curated lesson action; null for coach-authored items.';

create index if not exists coach_action_items_academy_lesson_idx
  on public.coach_action_items (coach_id, academy_lesson_id)
  where academy_lesson_id is not null;

-- ---------------------------------------------------------------------------
-- Starter actions for visual QA and the first onboarding tasks
-- ---------------------------------------------------------------------------
insert into public.academy_lesson_content (
  course_id,
  lesson_id,
  recommended_actions
)
values
  (
    'kickstart',
    'kickstart-welcome-introduce-yourself',
    '[{"id":"post-introduction","text":"Post your introduction in the community"}]'::jsonb
  ),
  (
    'kickstart',
    'kickstart-welcome-calendar-calls',
    '[{"id":"add-calls-calendar","text":"Add the coaching calls to your calendar"}]'::jsonb
  ),
  (
    'client-acquisition',
    'client-acquisition-ideal-clients-linkedin-sales-navigator-build-your-base-search',
    '[
      {"id":"open-base-search","text":"Open Sales Navigator and start a new lead search"},
      {"id":"apply-ideal-client-filters","text":"Apply the ideal-client filters from this lesson"},
      {"id":"save-search-and-prospects","text":"Save the search and add your first 25 prospects"}
    ]'::jsonb
  )
on conflict (course_id, lesson_id) do update
set
  recommended_actions = excluded.recommended_actions,
  updated_at = now();

-- ===========================================================================
-- 20260901160000_academy_lesson_draft_and_deleted.sql
-- ===========================================================================
-- Admin draft / soft-delete flags for academy lessons (merged over hub / catalog JSON).
alter table public.academy_lesson_content
  add column if not exists is_draft boolean not null default false;

alter table public.academy_lesson_content
  add column if not exists is_deleted boolean not null default false;

comment on column public.academy_lesson_content.is_draft is
  'When true, lesson is visible to admins only (hidden from coaches).';

comment on column public.academy_lesson_content.is_deleted is
  'Soft-delete: lesson is hidden from all academy UIs until removed from catalog JSON.';

-- ===========================================================================
-- 20260902120000_academy_progress_canonical_course_id.sql
-- ===========================================================================
-- Academy hub cards regroup the same lessons under different course ids, but
-- progress is keyed (user_id, course_id, lesson_id). A lesson ticked from the
-- programmes hub (course_id 'going-pro') stayed invisible on the Simplified
-- Start Here card (course_id 'kickstart'), and vice versa.
--
-- Progress now follows the programme that owns the lesson, derived from the
-- lesson id prefix. This backfills existing rows onto that canonical id,
-- keeping the strongest status per lesson so no coach loses a tick.
--
-- Keep in sync with `progressCourseId()` in
-- `src/lib/academy/simplifiedContentSource.ts`.

create or replace function public.academy_canonical_course_id(
  p_course_id text,
  p_lesson_id text
)
returns text
language sql
immutable
as $$
  select case
    when p_lesson_id like 'profit-coach-os-%' then 'profit-coach-os'
    when p_lesson_id like 'profit-coach-certification-%' then 'profit-coach-certification'
    when p_lesson_id like 'profit-brand-framework-%' then 'profit-brand-framework'
    when p_lesson_id like 'client-acquisition-%' then 'client-acquisition'
    when p_lesson_id like 'client-delivery-%' then 'client-delivery'
    when p_lesson_id like 'coach-action-plan-%' then 'coach-action-plan'
    when p_lesson_id like 'going-pro-%' then 'going-pro'
    when p_lesson_id like 'kickstart-%' then 'kickstart'
    else p_course_id
  end
$$;

comment on function public.academy_canonical_course_id(text, text) is
  'Programme course id that owns a lesson, from its id prefix; other course ids pass through.';

-- Progress: completed beats needs_review beats not_started; newest wins ties.
with ranked as (
  select
    user_id,
    public.academy_canonical_course_id(course_id, lesson_id) as canonical_course_id,
    lesson_id,
    status,
    updated_at,
    row_number() over (
      partition by
        user_id,
        public.academy_canonical_course_id(course_id, lesson_id),
        lesson_id
      order by
        case status
          when 'completed' then 0
          when 'needs_review' then 1
          else 2
        end,
        updated_at desc
    ) as rn
  from public.academy_lesson_progress
)
insert into public.academy_lesson_progress (user_id, course_id, lesson_id, status, updated_at)
select user_id, canonical_course_id, lesson_id, status, updated_at
from ranked
where rn = 1
on conflict (user_id, course_id, lesson_id) do update
set
  status = case
    when excluded.status = 'completed' then 'completed'
    when public.academy_lesson_progress.status = 'completed' then 'completed'
    when excluded.status = 'needs_review' then 'needs_review'
    else public.academy_lesson_progress.status
  end,
  updated_at = greatest(
    public.academy_lesson_progress.updated_at,
    excluded.updated_at
  );

delete from public.academy_lesson_progress
where course_id is distinct from public.academy_canonical_course_id(course_id, lesson_id);

-- Views: keep the most recent open per lesson so Resume lands in the right place.
with ranked as (
  select
    user_id,
    public.academy_canonical_course_id(course_id, lesson_id) as canonical_course_id,
    lesson_id,
    viewed_at,
    row_number() over (
      partition by
        user_id,
        public.academy_canonical_course_id(course_id, lesson_id),
        lesson_id
      order by viewed_at desc
    ) as rn
  from public.academy_lesson_views
)
insert into public.academy_lesson_views (user_id, course_id, lesson_id, viewed_at)
select user_id, canonical_course_id, lesson_id, viewed_at
from ranked
where rn = 1
on conflict (user_id, course_id, lesson_id) do update
set viewed_at = greatest(
  public.academy_lesson_views.viewed_at,
  excluded.viewed_at
);

delete from public.academy_lesson_views
where course_id is distinct from public.academy_canonical_course_id(course_id, lesson_id);

notify pgrst, 'reload schema';
