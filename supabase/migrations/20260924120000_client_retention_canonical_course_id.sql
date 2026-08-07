-- Map Progress Method Client Retention lessons onto the Coach Clients
-- programme course id used for academy_lesson_content / progress.
-- Keep in sync with PROGRAMME_PREFIXES in src/lib/academy/programmeContentSource.ts.

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
    when p_lesson_id like 'client-retention-%' then 'profit-coach-system'
    when p_lesson_id like 'coach-action-plan-%' then 'coach-action-plan'
    when p_lesson_id like 'going-pro-%' then 'going-pro'
    when p_lesson_id like 'kickstart-%' then 'kickstart'
    else p_course_id
  end
$$;

comment on function public.academy_canonical_course_id(text, text) is
  'Programme course id that owns a lesson, from its id prefix; other course ids pass through.';
