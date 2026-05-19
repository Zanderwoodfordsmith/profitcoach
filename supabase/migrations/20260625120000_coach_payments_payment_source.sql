alter table public.coach_payments
  add column if not exists payment_source text not null default 'stripe';

alter table public.coach_payments
  drop constraint if exists coach_payments_payment_source_check;

alter table public.coach_payments
  add constraint coach_payments_payment_source_check
  check (payment_source in ('stripe', 'revolut_merchant', 'revolut_direct'));

update public.coach_payments
set payment_source = 'stripe'
where payment_source is null
   or payment_source = ''
   or import_source = 'stripe_csv'
   or stripe_charge_id is not null
   or stripe_payment_intent_id is not null;

create index if not exists coach_payments_payment_source_paid_at_idx
  on public.coach_payments (payment_source, paid_at desc);
