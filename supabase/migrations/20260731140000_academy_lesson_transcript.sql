-- Transcript text for academy lessons (shown separately from body_markdown).
alter table public.academy_lesson_content
  add column if not exists transcript_text text;

comment on column public.academy_lesson_content.transcript_text is
  'Plain-text lesson transcript; displayed in a collapsible panel, not as lesson body.';
