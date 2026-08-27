-- Per-coach video chapter completion within consolidated / chaptered lessons.

create table if not exists public.academy_lesson_chapter_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  chapter_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id, chapter_id)
);

comment on table public.academy_lesson_chapter_progress is
  'Video chapter watch completion per coach (sidebar-style ticks in chapter menu).';

create index if not exists academy_lesson_chapter_progress_user_lesson_idx
  on public.academy_lesson_chapter_progress (user_id, lesson_id);

alter table public.academy_lesson_chapter_progress enable row level security;
