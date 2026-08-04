-- Welcome lesson: “Complete every lesson in Start Here” is system-verified (lock).
update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"choose-next-live-call","text":"Choose a live call to attend in the next seven days"},
    {"id":"complete-start-here","text":"Complete every lesson in Start Here","completion":"tracked","verifyRule":"start_here_lessons_complete"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'kickstart'
  and lesson_id = 'kickstart-welcome-welcome-program-overview';
