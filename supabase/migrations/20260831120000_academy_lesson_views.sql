-- Per-coach last-opened lesson timestamps for Resume Training.

create table if not exists public.academy_lesson_views (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);

comment on table public.academy_lesson_views is
  'Last time a coach opened a lesson; used by Resume Training (independent of completion ticks).';

create index if not exists academy_lesson_views_user_recent_idx
  on public.academy_lesson_views (user_id, viewed_at desc);

create index if not exists academy_lesson_views_user_course_idx
  on public.academy_lesson_views (user_id, course_id);

alter table public.academy_lesson_views enable row level security;
