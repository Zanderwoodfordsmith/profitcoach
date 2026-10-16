-- Practice Blueprint: write sections on the server, so closing the page does
-- not stop "Write my blueprint". One active job per coach. A job is worked by
-- the request that started it and then by the practice-build cron until done.
-- Server-only: RLS on, no client policies.

create table if not exists public.practice_build_jobs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  -- Section keys in build order.
  keys text[] not null default '{}',
  done text[] not null default '{}',
  -- [{ key, error }]
  failed jsonb not null default '[]'::jsonb,
  current_key text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'cancelled')),
  -- Refreshed while a worker is writing; a stale heartbeat lets the cron take over.
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists practice_build_jobs_coach_idx
  on public.practice_build_jobs (coach_id, created_at desc);
create index if not exists practice_build_jobs_open_idx
  on public.practice_build_jobs (status)
  where status in ('queued', 'running');

alter table public.practice_build_jobs enable row level security;
