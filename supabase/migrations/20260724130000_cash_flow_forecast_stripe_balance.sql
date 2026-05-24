alter table public.cash_flow_forecast_settings
add column if not exists stripe_balance_cents bigint not null default 0,
add column if not exists stripe_balance_as_of date;

comment on column public.cash_flow_forecast_settings.stripe_balance_cents is
  'Pending Stripe balance (minor units). Forecasted into bank 2 UK business days after stripe_balance_as_of.';

comment on column public.cash_flow_forecast_settings.stripe_balance_as_of is
  'Calendar date the Stripe balance was last checked (YYYY-MM-DD).';
