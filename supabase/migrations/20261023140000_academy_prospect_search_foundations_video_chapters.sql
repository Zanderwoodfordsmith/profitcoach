-- Consolidate prospect search foundations (mindset, FIND, KPIs) into one chaptered lesson.
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
  'get-calls-ideal-clients-finding-ideal-clients-mindset-and-search',
  'Finding Ideal Clients: Mindset & Search',
  '27m',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'proactive-prospecting',
      'title', 'Proactive Prospecting: Your Path to Finding Ideal Clients',
      'source_lesson_id', 'get-calls-ideal-clients-proactive-prospecting-your-path-to-finding-ideal-clients',
      'duration', '10m'
    ),
    jsonb_build_object(
      'id', 'find-principles',
      'title', 'Principles of Effective Prospect Search (FIND)',
      'source_lesson_id', 'get-calls-ideal-clients-principles-of-effective-prospect-search-find',
      'duration', '8m'
    ),
    jsonb_build_object(
      'id', 'list-kpis',
      'title', 'Evaluating Prospect List KPIs',
      'source_lesson_id', 'get-calls-ideal-clients-evaluating-prospect-list-kpis',
      'duration', '9m'
    )
  ),
  now()
)
on conflict (course_id, lesson_id) do update set
  title = excluded.title,
  duration = excluded.duration,
  video_chapters = excluded.video_chapters,
  updated_at = excluded.updated_at;
