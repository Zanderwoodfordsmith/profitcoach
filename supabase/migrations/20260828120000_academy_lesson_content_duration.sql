-- Sidebar lesson length (e.g. "6m"), editable with video/body in the admin lesson editor.
alter table public.academy_lesson_content
  add column if not exists duration text;

comment on column public.academy_lesson_content.duration is
  'Optional display duration override (e.g. 6m); merged over hub/catalog duration.';
