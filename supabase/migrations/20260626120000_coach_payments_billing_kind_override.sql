alter table public.coach_payments
add column if not exists billing_kind_override text;

alter table public.coach_payments
drop constraint if exists coach_payments_billing_kind_override_check;

alter table public.coach_payments
add constraint coach_payments_billing_kind_override_check
check (
  billing_kind_override is null
  or billing_kind_override in ('recurring', 'initial', 'installment', 'other')
);

comment on column public.coach_payments.billing_kind_override is
  'Admin override for Billing column (recurring, initial/new, installment/plan, other). Null = auto-detect.';
