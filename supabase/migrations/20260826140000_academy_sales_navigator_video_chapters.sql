-- Consolidate LinkedIn Sales Navigator core workflow into one chaptered lesson.
insert into public.academy_lesson_content (
  course_id,
  lesson_id,
  title,
  duration,
  video_chapters,
  updated_at
)
values (
  'get-calls',
  'get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list',
  'LinkedIn Sales Navigator: Build Your Prospect List',
  '45m',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'sign-up',
      'title', 'LinkedIn Sales Navigator: Sign Up',
      'source_lesson_id', 'get-calls-ideal-clients-linkedin-sales-navigator-sign-up',
      'duration', '4m'
    ),
    jsonb_build_object(
      'id', 'base-search',
      'title', 'LinkedIn Sales Navigator: Build Your Base Search',
      'source_lesson_id', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-base-search',
      'duration', '11m'
    ),
    jsonb_build_object(
      'id', 'prospect-list',
      'title', 'LinkedIn Sales Navigator: Build Your Ideal Prospect List',
      'source_lesson_id', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-ideal-prospect-list',
      'duration', '15m'
    ),
    jsonb_build_object(
      'id', 'refining-blacklist',
      'title', 'LinkedIn Sales Navigator: Refining Your Ideal Prospect List (Blacklisting)',
      'source_lesson_id', 'get-calls-ideal-clients-linkedin-sales-navigator-refining-your-ideal-prospect-list-blacklisting',
      'duration', '15m'
    )
  ),
  now()
)
on conflict (course_id, lesson_id) do update set
  title = excluded.title,
  duration = excluded.duration,
  video_chapters = excluded.video_chapters,
  updated_at = excluded.updated_at;
