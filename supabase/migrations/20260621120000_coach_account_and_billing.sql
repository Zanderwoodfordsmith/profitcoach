alter table public.coaches
add column if not exists has_sales_robot_account boolean not null default false,
add column if not exists has_profit_coach_email_account boolean not null default false,
add column if not exists recurring_payment_status text;

alter table public.coaches
drop constraint if exists coaches_recurring_payment_status_check;

alter table public.coaches
add constraint coaches_recurring_payment_status_check
check (
  recurring_payment_status is null
  or recurring_payment_status in (
    'monthly',
    'annual_prepaid',
    'first_6_months',
    'complimentary',
    'overdue'
  )
);

comment on column public.coaches.has_sales_robot_account is
  'Admin-only: coach has a Sales Robot account.';

comment on column public.coaches.has_profit_coach_email_account is
  'Admin-only: coach has a Profit Coach email account.';

comment on column public.coaches.recurring_payment_status is
  'Admin-only recurring billing: monthly, annual_prepaid, first_6_months, complimentary, or overdue.';
