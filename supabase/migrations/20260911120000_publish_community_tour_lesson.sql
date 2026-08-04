-- Publish Start Here Community Tour (video + copy ready for coaches).

update public.academy_lesson_content
set
  is_draft = false,
  updated_at = now()
where course_id = 'kickstart'
  and lesson_id = 'kickstart-welcome-community-tour';
