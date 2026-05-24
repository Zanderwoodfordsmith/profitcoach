-- Zander-only cash flow forecast settings (access enforced in API, not RLS tier).

create table if not exists public.cash_flow_forecast_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  opening_balance_cents bigint not null default 0,
  start_monday date,
  expense_rows jsonb not null default '[]'::jsonb,
  excluded_stream_keys jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (opening_balance_cents >= 0),
  check (expense_rows is not null),
  check (excluded_stream_keys is not null)
);

comment on table public.cash_flow_forecast_settings is
  'Per-admin cash flow forecast inputs (opening balance, expense grid). API restricts to allowlisted emails.';

alter table public.cash_flow_forecast_settings enable row level security;

drop policy if exists "User reads own cash flow forecast settings"
  on public.cash_flow_forecast_settings;
create policy "User reads own cash flow forecast settings"
  on public.cash_flow_forecast_settings
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "User upserts own cash flow forecast settings"
  on public.cash_flow_forecast_settings;
create policy "User upserts own cash flow forecast settings"
  on public.cash_flow_forecast_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "User updates own cash flow forecast settings"
  on public.cash_flow_forecast_settings;
create policy "User updates own cash flow forecast settings"
  on public.cash_flow_forecast_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
