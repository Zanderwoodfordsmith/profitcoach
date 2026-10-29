-- Practice calls coaches made on the old Retell simulators (Jun 2025 to Oct
-- 2026), imported once by scripts/retell-import.ts so we can see where coaches
-- are weakest. Retell didn't record who the coach was, so coach_id is set only
-- where the coach said their full name (or a first name only one profile has).
-- Scored with the Client simulator scorer. Admin only.

create table if not exists public.retell_practice_calls (
  call_id text primary key,
  agent_name text not null,
  -- The in-app client the Retell agent became (src/lib/simulator/clients.ts);
  -- null for the sales objection agent, which isn't scored.
  client_id text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  started_at timestamptz not null,
  duration_seconds integer not null,
  coach_id uuid references public.profiles (id) on delete set null,
  -- The name the coach gave on the call, if any.
  coach_name_heard text,
  -- The coaching part only, before Retell switched to spoken feedback.
  -- [{ role: "coach" | "client", text, at }]
  transcript jsonb not null default '[]'::jsonb,
  -- Mono MP3 in the retell-recordings bucket.
  recording_path text,
  report jsonb,
  score integer check (score between 0 and 50),
  imported_at timestamptz not null default now()
);

create index if not exists retell_practice_calls_coach_idx on public.retell_practice_calls (coach_id, started_at desc);

alter table public.retell_practice_calls enable row level security;
-- Server only.

insert into storage.buckets (id, name, public)
values ('retell-recordings', 'retell-recordings', false)
on conflict (id) do nothing;
