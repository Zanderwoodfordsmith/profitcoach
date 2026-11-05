-- When a Blueprint page moves (Needs you, BCA to do, In progress, Review,
-- Done), one row here (5 Nov). Shown as a quiet line in that page's chat.
-- Page status is worked out from the Blueprint, so moves are recorded when a
-- save changes it, from now on. Additive only.

create table if not exists public.practice_page_status_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  page_slug text not null,
  from_status text not null,
  to_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists practice_page_status_events_coach
  on public.practice_page_status_events (coach_id, created_at);

-- Server only (service role), like practice_section_comments.
alter table public.practice_page_status_events enable row level security;
