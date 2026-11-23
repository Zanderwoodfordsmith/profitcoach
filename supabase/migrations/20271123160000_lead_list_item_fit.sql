-- Fit on every person in a coach's lists (job 278, 23 Nov): Good, OK or Bad.
-- Ava sets it as people are imported (fit_by 'ava'); the coach or BCA can
-- change it (fit_by 'person'), and Ava never overwrites a person's call.
-- Blacklist stays its own list (kind 'blacklist'). Campaigns skip Bad and
-- take Good before OK, then people nobody has checked yet (fit_rank).
alter table public.coach_lead_list_items
  add column if not exists fit text check (fit in ('good', 'ok', 'bad')),
  add column if not exists fit_why text,
  add column if not exists fit_by text check (fit_by in ('ava', 'person')),
  add column if not exists fit_at timestamptz,
  add column if not exists fit_rank smallint generated always as (
    case fit when 'good' then 0 when 'ok' then 1 when 'bad' then 3 else 2 end
  ) stored;

create index if not exists coach_lead_list_items_coach_bad_fit_idx
  on public.coach_lead_list_items (coach_id)
  where fit = 'bad';
