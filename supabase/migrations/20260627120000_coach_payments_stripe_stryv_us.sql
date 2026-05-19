alter table public.coach_payments
drop constraint if exists coach_payments_payment_source_check;

alter table public.coach_payments
add constraint coach_payments_payment_source_check
check (
  payment_source in (
    'stripe',
    'stripe_stryv_us',
    'revolut_merchant',
    'revolut_direct'
  )
);

comment on column public.coach_payments.payment_source is
  'stripe = main Stripe account; stripe_stryv_us = legacy US Stripe (Stryv / BCA ThriveCart); revolut_merchant; revolut_direct.';
