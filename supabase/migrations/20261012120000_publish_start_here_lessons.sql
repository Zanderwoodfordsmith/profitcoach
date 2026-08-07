-- Publish Start Here lessons 1–8 for coaches; keep Tools & Bonuses (last) as draft.

insert into public.academy_lesson_content (course_id, lesson_id, is_draft, updated_at)
values
  ('kickstart', 'kickstart-welcome-welcome-program-overview', false, now()),
  ('kickstart', 'kickstart-welcome-member-wins', false, now()),
  ('kickstart', 'kickstart-welcome-pick-your-path', false, now()),
  ('kickstart', 'kickstart-welcome-introduce-yourself', false, now()),
  ('kickstart', 'kickstart-welcome-community-tour', false, now()),
  ('kickstart', 'kickstart-welcome-classroom-tour', false, now()),
  ('kickstart', 'kickstart-welcome-calendar-calls', false, now()),
  ('kickstart', 'kickstart-welcome-support', false, now())
on conflict (course_id, lesson_id) do update
set
  is_draft = excluded.is_draft,
  updated_at = now();

-- Explicitly keep the last Start Here lesson as draft.
insert into public.academy_lesson_content (course_id, lesson_id, is_draft, updated_at)
values
  ('kickstart', 'kickstart-welcome-tools-bonuses', true, now())
on conflict (course_id, lesson_id) do update
set
  is_draft = true,
  updated_at = now();
