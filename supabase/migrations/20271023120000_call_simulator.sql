-- Get Clients → Scripts → Call simulator: voice practice of sales calls with
-- AI prospects. One row per session. Calls, objections and scoring guides
-- live in code (src/lib/callSimulator). Same voice agent as sim_sessions.

create table if not exists public.call_sim_sessions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  prospect_id text not null,
  call_id text not null,
  -- The part the coach chose to start at, or null for the whole call.
  start_part text,
  -- For objection drills: the objections, in the order they're raised.
  objections text[] not null default '{}',
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  tips boolean not null default true,
  status text not null default 'live' check (status in ('live', 'scoring', 'scored', 'abandoned')),
  -- [{ role: "coach" | "client", text, at }]
  transcript jsonb not null default '[]'::jsonb,
  -- Latest live check: { stage, covered, found, tip }
  live jsonb not null default '{}'::jsonb,
  -- ElevenLabs conversation ids, one per stretch between time outs or skips.
  conversation_ids text[] not null default '{}',
  time_outs integer not null default 0,
  report jsonb,
  -- Out of 100.
  score integer check (score between 0 and 100),
  outcome text check (outcome in ('won', 'step', 'lost')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists call_sim_sessions_coach_idx on public.call_sim_sessions (coach_id, started_at desc);

alter table public.call_sim_sessions enable row level security;
-- Server only (the call simulator API checks the coach).
