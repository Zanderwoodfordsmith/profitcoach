-- Client simulator, round 2: clients coaches make themselves, replays of a
-- single moment, sharing a session with the community.

-- "Create your own": a coach describes a situation and the AI builds a client.
create table if not exists public.sim_custom_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  -- The coach's own words, kept so the client can be rebuilt or revised.
  situation text not null,
  is_real boolean not null default false,
  -- The client, in the same shape as the built-in cast (src/lib/simulator/types.ts SimClient).
  client jsonb not null,
  face_url text,
  status text not null default 'draft' check (status in ('draft', 'ready')),
  -- Other coaches can find it under "From other coaches".
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sim_custom_clients_coach_idx on public.sim_custom_clients (coach_id, created_at desc);
create index if not exists sim_custom_clients_shared_idx on public.sim_custom_clients (shared) where shared;

alter table public.sim_custom_clients enable row level security;
-- Server only (the simulator API checks the coach).

-- "Try that moment again": a short call that restarts just before one line of an earlier session.
alter table public.sim_sessions add column if not exists replay_of uuid references public.sim_sessions (id) on delete set null;
alter table public.sim_sessions add column if not exists replay_line integer;

-- Where each line sits in the recording: which part (between time outs) and seconds into it.
-- Kept inside transcript lines as { part, t }; nothing to add here.

-- Sharing a report with other coaches (from a community post).
alter table public.sim_sessions add column if not exists shared_at timestamptz;
alter table public.sim_sessions add column if not exists share_score boolean not null default true;

-- How many extra scoring passes were averaged (certification scores twice).
alter table public.sim_sessions add column if not exists scoring_passes integer not null default 1;
