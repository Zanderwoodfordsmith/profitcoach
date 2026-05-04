-- My Scorecard (v1): one row per coach per ISO week (week_start = Monday).

create table if not exists public.coach_scorecard_week (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start_date date not null,
  manual_values jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start_date),
  check (manual_values is not null)
);

create index if not exists coach_scorecard_week_user_week_idx
  on public.coach_scorecard_week (user_id, week_start_date desc);

alter table public.coach_scorecard_week enable row level security;

drop policy if exists "Coach reads own scorecard weeks"
  on public.coach_scorecard_week;
create policy "Coach reads own scorecard weeks"
  on public.coach_scorecard_week
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Coach inserts own scorecard weeks"
  on public.coach_scorecard_week;
create policy "Coach inserts own scorecard weeks"
  on public.coach_scorecard_week
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Coach updates own scorecard weeks"
  on public.coach_scorecard_week;
create policy "Coach updates own scorecard weeks"
  on public.coach_scorecard_week
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach deletes own scorecard weeks"
  on public.coach_scorecard_week;
create policy "Coach deletes own scorecard weeks"
  on public.coach_scorecard_week
  for delete
  to authenticated
  using (user_id = auth.uid());
