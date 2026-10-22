-- Ava nudges: a daily scan finds coaches who are stuck and drafts a nudge
-- from a template for where they're stuck. BCA approves, edits or rejects
-- each one before anything reaches the coach.

create table if not exists public.ava_nudges (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  scan_date date not null default current_date,
  level text not null,
  stuck_at text not null,
  next_step text,
  -- The template draft, then BCA's edits.
  body text not null,
  status text not null default 'queued',
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  posted_at timestamptz,
  post_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ava_nudges_status_check
    check (status in ('queued', 'approved', 'rejected', 'posted', 'skipped')),
  constraint ava_nudges_one_per_coach_per_day unique (coach_id, scan_date)
);

create index if not exists ava_nudges_status_idx on public.ava_nudges (status, scan_date desc);

alter table public.ava_nudges enable row level security;
-- Service role only (admin APIs); no member policies.

comment on table public.ava_nudges is
  'Daily Ava nudges for stuck coaches, queued for BCA approval before they post.';
