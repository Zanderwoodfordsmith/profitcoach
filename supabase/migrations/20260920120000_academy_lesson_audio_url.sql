-- Optional listen-along MP3 (or other audio URL) for classroom / compass lessons.
alter table public.academy_lesson_content
  add column if not exists audio_url text;

comment on column public.academy_lesson_content.audio_url is
  'Public URL for lesson audio (MP3 under academy-lessons storage, or external). Shown under the video as Listen.';
