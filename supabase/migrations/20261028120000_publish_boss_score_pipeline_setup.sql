-- Pipeline Setup now owns lead magnets (BOSS). Publish so coaches see it
-- alongside LinkedIn Profile; calendar scheduling stays draft in the hub.

update public.academy_lesson_content
set
  is_draft = false,
  updated_at = now()
where course_id = 'get-calls'
  and lesson_id = 'get-calls-boss-assessment-marketing-how-to-use-the-boss-score-assessment';
