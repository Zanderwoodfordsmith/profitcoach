-- BCA group tests: one step with 2 or 3 fixed versions that many coaches run
-- at once, so results pool into samples big enough to learn from.
-- Coaches fill their own slots (e.g. who they help); the wording is locked.

create table if not exists public.group_tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hypothesis text,
  step_type text not null default 'message' check (step_type in ('invite', 'message')),
  arms jsonb not null default '[]'::jsonb,
  slots jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  target_per_arm int not null default 1500,
  created_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_test_enrolments (
  id uuid primary key default gen_random_uuid(),
  group_test_id uuid not null references public.group_tests (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  campaign_id uuid not null references public.linkedin_campaigns (id) on delete cascade,
  step_id uuid not null references public.linkedin_campaign_steps (id) on delete cascade,
  fills jsonb not null default '{}'::jsonb,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  unique (step_id)
);
create index if not exists group_test_enrolments_test_idx on public.group_test_enrolments (group_test_id);

alter table public.group_tests enable row level security;
alter table public.group_test_enrolments enable row level security;
revoke all on public.group_tests from anon, authenticated;
revoke all on public.group_test_enrolments from anon, authenticated;
grant all on public.group_tests to service_role;
grant all on public.group_test_enrolments to service_role;
