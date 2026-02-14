-- Landing A/B tests and events
create table if not exists landing_tests (
  id uuid primary key default gen_random_uuid(),
  name text,
  variant_a_slug text not null default 'a',
  variant_b_slug text not null default 'b',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  winner_variant text check (winner_variant in ('a', 'b')),
  status text not null default 'running' check (status in ('draft', 'running', 'completed'))
);

create table if not exists landing_events (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references landing_tests(id) on delete cascade,
  variant text not null check (variant in ('a', 'b')),
  coach_slug text,
  event_type text not null check (event_type in ('view', 'start', 'opt_in', 'finish')),
  session_id text,
  contact_id uuid,
  assessment_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists landing_events_test_id on landing_events(test_id);
create index if not exists landing_events_created_at on landing_events(created_at);
create index if not exists landing_events_variant on landing_events(variant);
create index if not exists landing_events_coach_slug on landing_events(coach_slug);

-- Optional: ensure only one running test (application can enforce or use partial unique index)
-- create unique index landing_tests_one_running on landing_tests(id) where status = 'running';

-- Add coach display fields to profiles (run only if columns don't exist)
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists linkedin_url text;
