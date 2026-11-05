-- Blueprint progress over time (4 Nov). Additive only: one new table.
--
-- Once a day, a cron saves where every coach's Blueprint stands: each page's
-- status (column) and In progress tag, its points, and the coach's total as a
-- percentage. Points per page: Needs coach 0, BCA to do 0, In progress 2
-- (3 with a draft to check, 4 when checking before sending), Coach review 4,
-- Done 5. From these rows we can draw a coach's progress line and work out
-- how long pages sit in each status.
--
-- pages: { "<page slug>": { "column": "...", "tag": "..." | null, "points": n } }
--
-- Server only: RLS on, no policies, so only the service role reads or writes.

create table if not exists public.blueprint_progress_snapshots (
  coach_id uuid not null,
  day date not null,
  percent smallint not null,
  points smallint not null,
  max_points smallint not null,
  pages jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (coach_id, day)
);

create index if not exists blueprint_progress_snapshots_day_idx
  on public.blueprint_progress_snapshots (day);

alter table public.blueprint_progress_snapshots enable row level security;
