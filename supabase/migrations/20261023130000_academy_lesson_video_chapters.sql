-- Sequential main-lesson video chapters (distinct from optional satellites).
alter table public.academy_lesson_content
  add column if not exists video_chapters jsonb;

comment on column public.academy_lesson_content.video_chapters is
  'Ordered main watch path: [{ id, title, video_url?, source_lesson_id?, duration? }]. Satellites stay optional extras.';

-- Consolidate Book & Run Value Sessions into one chaptered lesson.
insert into public.academy_lesson_content (
  course_id,
  lesson_id,
  title,
  duration,
  video_chapters,
  updated_at
)
values (
  'win-clients',
  'win-clients-book-and-run-value-sessions',
  'Book & Run Value Sessions',
  '47m',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'what-is-a-value-session',
      'title', 'What Is A Value Session',
      'source_lesson_id', 'win-clients-getting-paid-clients-using-value-sessions-what-is-a-value-session',
      'duration', '5m'
    ),
    jsonb_build_object(
      'id', 'how-value-sessions-get-clients',
      'title', 'How Do Value Sessions Get You Clients',
      'source_lesson_id', 'win-clients-getting-paid-clients-using-value-sessions-how-do-value-sessions-get-you-clients',
      'duration', '3m'
    ),
    jsonb_build_object(
      'id', 'messages-to-book',
      'title', 'Messages To Book Value Sessions',
      'source_lesson_id', 'win-clients-getting-paid-clients-using-value-sessions-messages-to-book-value-session',
      'duration', '7m'
    ),
    jsonb_build_object(
      'id', 'crm-calendar',
      'title', 'How To Create Value Session Calendar In The CRM',
      'source_lesson_id', 'win-clients-getting-paid-clients-using-value-sessions-how-to-create-cvalue-session-calendar-in-the-crm',
      'duration', '3m'
    ),
    jsonb_build_object(
      'id', 'how-to-deliver',
      'title', 'How To Deliver A Value Session',
      'source_lesson_id', 'win-clients-getting-paid-clients-using-value-sessions-how-to-deliver-a-value-session',
      'duration', '15m'
    ),
    jsonb_build_object(
      'id', 'improve-your-business',
      'title', 'How Value Sessions Improve Your Business',
      'source_lesson_id', 'win-clients-getting-paid-clients-using-value-sessions-how-value-sessions-improve-your-business',
      'duration', '10m'
    ),
    jsonb_build_object(
      'id', 'how-to-sell',
      'title', 'How To "Sell" On A Value Session',
      'source_lesson_id', 'win-clients-getting-paid-clients-using-value-sessions-how-to-sell-on-a-value-session',
      'duration', '4m'
    )
  ),
  now()
)
on conflict (course_id, lesson_id) do update set
  title = excluded.title,
  duration = excluded.duration,
  video_chapters = excluded.video_chapters,
  updated_at = excluded.updated_at;
