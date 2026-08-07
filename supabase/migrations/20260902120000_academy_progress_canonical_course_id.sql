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
