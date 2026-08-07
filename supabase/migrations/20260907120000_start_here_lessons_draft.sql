-- Hide Start Here onboarding lessons from coaches while content is being finished.
-- Admins still see them (draft = admin-only).

insert into public.academy_lesson_content (course_id, lesson_id, is_draft, updated_at)
values
  ('kickstart', 'kickstart-welcome-welcome-program-overview', true, now()),
  ('kickstart', 'kickstart-welcome-member-wins', true, now()),
  ('kickstart', 'kickstart-welcome-pick-your-path', true, now()),
  ('kickstart', 'kickstart-welcome-introduce-yourself', true, now()),
  ('kickstart', 'kickstart-welcome-community-tour', true, now()),
  ('kickstart', 'kickstart-welcome-classroom-tour', true, now()),
  ('kickstart', 'kickstart-welcome-calendar-calls', true, now()),
  ('kickstart', 'kickstart-welcome-support', true, now()),
  ('kickstart', 'kickstart-welcome-tools-bonuses', true, now())
on conflict (course_id, lesson_id) do update
set
  is_draft = true,
  updated_at = now();
