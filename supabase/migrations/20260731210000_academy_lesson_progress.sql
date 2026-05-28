-- Per-coach lesson progress (complete / needs review) with event log for analytics.

create table if not exists public.academy_lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'completed', 'needs_review')),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);

comment on table public.academy_lesson_progress is
  'Current lesson progress per coach; merged into lesson UI (sidebar + header).';

create index if not exists academy_lesson_progress_user_course_idx
  on public.academy_lesson_progress (user_id, course_id);

create table if not exists public.academy_lesson_progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  from_status text not null
    check (from_status in ('not_started', 'completed', 'needs_review')),
  to_status text not null
    check (to_status in ('not_started', 'completed', 'needs_review')),
  actor_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.academy_lesson_progress_events is
  'Append-only log of lesson progress changes for analytics and admin audit.';

create index if not exists academy_lesson_progress_events_user_idx
  on public.academy_lesson_progress_events (user_id, created_at desc);

create index if not exists academy_lesson_progress_events_lesson_idx
  on public.academy_lesson_progress_events (course_id, lesson_id, created_at desc);

alter table public.academy_lesson_progress enable row level security;
alter table public.academy_lesson_progress_events enable row level security;
