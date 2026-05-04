-- Optional first Monday of the scorecard grid (column 0). Null = use rolling default on client.

alter table public.profiles
  add column if not exists scorecard_period_start_monday date;
