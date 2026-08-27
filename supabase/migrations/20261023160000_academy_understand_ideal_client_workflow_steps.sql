-- Consolidate client empathy exercises (day + mentor) into one workflow lesson.
insert into public.academy_lesson_content (
  course_id,
  lesson_id,
  title,
  duration,
  body_markdown,
  recommended_actions,
  video_chapters,
  updated_at
)
values (
  'get-calls',
  'get-calls-ideal-clients-understand-your-ideal-client',
  'Understand Your Ideal Client',
  '',
  E'### What is this?\n\nWalk in your core client''s shoes so your outreach speaks to what they actually want — not what you think they need.\n\n### How to use this lesson\n\nWork through both steps in the **Guide** tab in order: map their day first, then capture their voice in the Mentor Exercise.',
  '[
    {"id":"write-current-day","text":"Write your core client''s current day from morning to evening in their world"},
    {"id":"write-ideal-day","text":"Write their ideal day from morning to evening"},
    {"id":"list-frustrations-and-goals","text":"List the frustrations and goals that sit in the gap between those two days"},
    {"id":"note-messaging-angles","text":"Note 3 messaging angles that wrap what they need in what they already want"},
    {"id":"mentor-rant-answer","text":"Answer \"How can I help?\" in your prospect''s exact words (rant allowed — their language, not yours)"},
    {"id":"mentor-specific-fix","text":"Answer \"What specifically do you need help with?\" in their words"},
    {"id":"save-messaging-source-language","text":"Save both answers as source language for your outreach and offer messaging"}
  ]'::jsonb,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'clients-day',
      'title', 'Give Them What They Want: Understanding Your Client''s Day',
      'source_lesson_id', 'get-calls-ideal-clients-give-them-what-they-want-understanding-your-client-s-day'
    ),
    jsonb_build_object(
      'id', 'mentor-exercise',
      'title', 'The Mentor Exercise',
      'source_lesson_id', 'get-calls-ideal-clients-the-mentor-exercise'
    )
  ),
  now()
)
on conflict (course_id, lesson_id) do update set
  title = excluded.title,
  duration = excluded.duration,
  body_markdown = excluded.body_markdown,
  recommended_actions = excluded.recommended_actions,
  video_chapters = excluded.video_chapters,
  updated_at = excluded.updated_at;
