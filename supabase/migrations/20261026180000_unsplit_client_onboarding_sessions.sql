-- Restore client onboarding sessions 1–4 as separate sidebar lessons.

delete from public.academy_lesson_content
where course_id = 'coach-clients'
  and lesson_id = 'coach-clients-onboard-a-new-client-sessions-1-4';
