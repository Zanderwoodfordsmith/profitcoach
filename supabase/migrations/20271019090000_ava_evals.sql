-- Ava evals and coach quality scores.
-- Additive only. Server-side tables (service role); admins read them through
-- /api/admin/ava/evals and /api/admin/coach-quality.
--
-- 1. ava_eval_runs: one row per run of the eval suite (Ava's skills on fixed
--    test cases), the coach audit (every coach's live profile and campaigns
--    scored with the same rubrics), or the outcome calibration.
create table if not exists public.ava_eval_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('suite', 'coach_audit', 'calibration')),
  label text,
  skills text[] not null default '{}',
  git_sha text,
  config jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  cost_usd numeric(10, 4),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists ava_eval_runs_kind_idx on public.ava_eval_runs (kind, started_at desc);

-- 2. ava_eval_results: one row per (case, rep) in a suite run.
--    status 'error' rows never count as a model failure in the summary.
create table if not exists public.ava_eval_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ava_eval_runs (id) on delete cascade,
  skill text not null,
  case_id text not null,
  rep int not null default 0,
  status text not null check (status in ('scored', 'truncated', 'error')),
  score numeric(5, 2),
  passed boolean,
  hard_fails text[] not null default '{}',
  checks jsonb not null default '[]'::jsonb,
  judge jsonb,
  metrics jsonb not null default '{}'::jsonb,
  output text,
  trajectory jsonb,
  usage jsonb,
  cost_usd numeric(10, 5),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists ava_eval_results_run_idx on public.ava_eval_results (run_id, skill, case_id);

-- 3. coach_quality_scores: one row per coach per artifact per audit run.
--    artifact: linkedin.headline | linkedin.about | linkedin.experience |
--    linkedin.basics | campaign.connection | campaign.followups | campaign.nurture
create table if not exists public.coach_quality_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.ava_eval_runs (id) on delete set null,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  artifact text not null,
  source_ref text,
  source_at timestamptz,
  text_scored text,
  score numeric(5, 2),
  hard_fails text[] not null default '{}',
  checks jsonb not null default '[]'::jsonb,
  judge jsonb,
  top_fix text,
  scored_at timestamptz not null default now()
);

create index if not exists coach_quality_scores_coach_idx
  on public.coach_quality_scores (coach_id, artifact, scored_at desc);
create index if not exists coach_quality_scores_run_idx on public.coach_quality_scores (run_id);

alter table public.ava_eval_runs enable row level security;
alter table public.ava_eval_results enable row level security;
alter table public.coach_quality_scores enable row level security;
revoke all on public.ava_eval_runs from anon, authenticated;
revoke all on public.ava_eval_results from anon, authenticated;
revoke all on public.coach_quality_scores from anon, authenticated;
grant all on public.ava_eval_runs to service_role;
grant all on public.ava_eval_results to service_role;
grant all on public.coach_quality_scores to service_role;
