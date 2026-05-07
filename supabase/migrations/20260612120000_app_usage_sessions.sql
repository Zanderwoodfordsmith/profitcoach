create table if not exists public.app_usage_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  entry_path text,
  last_path text,
  page_views integer not null default 1 check (page_views >= 0),
  heartbeat_count integer not null default 0 check (heartbeat_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists app_usage_sessions_user_id_idx
  on public.app_usage_sessions (user_id);

create index if not exists app_usage_sessions_last_activity_idx
  on public.app_usage_sessions (last_activity_at desc);

create index if not exists app_usage_sessions_started_at_idx
  on public.app_usage_sessions (started_at desc);

alter table public.app_usage_sessions enable row level security;
