-- Keep Clients → Client simulator: voice practice sessions with AI clients.
-- One row per session. A certification attempt groups three sessions.
-- Clients, situations and scoring guides live in code (src/lib/simulator).

create table if not exists public.sim_assessments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'reviewed')),
  -- Average of the sessions' scores out of 50, set when submitted.
  average numeric(4, 1),
  passed boolean,
  -- The reviewer's final say, which wins over the AI's.
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists sim_assessments_coach_idx on public.sim_assessments (coach_id, created_at desc);

create table if not exists public.sim_sessions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id text not null,
  situation_id text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  tips boolean not null default true,
  mode text not null default 'practice' check (mode in ('practice', 'assessment')),
  assessment_id uuid references public.sim_assessments (id) on delete set null,
  -- "Continue with David": the session this one follows on from.
  follows_session_id uuid references public.sim_sessions (id) on delete set null,
  status text not null default 'live' check (status in ('live', 'scoring', 'scored', 'abandoned')),
  -- [{ role: "coach" | "client", text, at }]
  transcript jsonb not null default '[]'::jsonb,
  -- Latest live check: { stage, found: [fact ids], tip }
  live jsonb not null default '{}'::jsonb,
  -- ElevenLabs conversation ids, one per stretch between time outs.
  conversation_ids text[] not null default '{}',
  time_outs integer not null default 0,
  report jsonb,
  score integer check (score between 0 and 50),
  -- Reviewer's change to the score (assessments only).
  reviewed_score integer check (reviewed_score between 0 and 50),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists sim_sessions_coach_idx on public.sim_sessions (coach_id, started_at desc);
create index if not exists sim_sessions_assessment_idx on public.sim_sessions (assessment_id);

alter table public.sim_assessments enable row level security;
alter table public.sim_sessions enable row level security;
-- Server only (the simulator API checks the coach).
