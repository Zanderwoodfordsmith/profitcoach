-- AI Agent: an assistant that operates Get Clients (lists, imports, campaigns)
-- for admins (any coach) and, when switched on, for a coach's own account.
-- Server-only tables: RLS on with no client policies, so only the service role
-- reads and writes them. Pending actions must never be client-writable.

create table if not exists public.ai_agent_chats (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('admin', 'coach')),
  -- The coach the agent is currently acting on.
  coach_id uuid references public.profiles(id) on delete set null,
  title text not null default 'New chat',
  -- Append-only Anthropic Messages transcript (tool calls, results, thinking).
  api_messages jsonb not null default '[]'::jsonb,
  opened_capabilities text[] not null default '{}',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_agent_chats_actor_updated_idx
  on public.ai_agent_chats (actor_user_id, updated_at desc);

create table if not exists public.ai_agent_actions (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.ai_agent_chats(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  tool text not null,
  -- Frozen at proposal time; confirm runs exactly this input.
  input jsonb not null default '{}'::jsonb,
  title text not null,
  details jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists ai_agent_actions_chat_idx
  on public.ai_agent_actions (chat_id, created_at);

alter table public.ai_agent_chats enable row level security;
alter table public.ai_agent_actions enable row level security;

alter table public.coaches
  add column if not exists ai_agent_enabled boolean not null default false;

comment on column public.coaches.ai_agent_enabled is
  'When true, the coach can use the AI Agent on their own account. Admins always can.';
