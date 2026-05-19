alter table public.coach_payments
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_invoice_id text,
  add column if not exists customer_company_name text,
  add column if not exists description text,
  add column if not exists decline_reason text,
  add column if not exists import_source text,
  add column if not exists import_row_key text;

create unique index if not exists coach_payments_stripe_charge_id_key
  on public.coach_payments (stripe_charge_id)
  where stripe_charge_id is not null;

create unique index if not exists coach_payments_import_row_key_key
  on public.coach_payments (import_row_key)
  where import_row_key is not null;

create index if not exists coach_payments_status_paid_at_idx
  on public.coach_payments (status, paid_at desc);

alter table public.coach_payments
  drop constraint if exists coach_payments_status_check;

alter table public.coach_payments
  add constraint coach_payments_status_check
  check (status in ('succeeded', 'pending', 'failed', 'refunded', 'canceled'));

alter table public.coach_payments
  drop constraint if exists coach_payments_assignment_method_check;

alter table public.coach_payments
  add constraint coach_payments_assignment_method_check
  check (
    assignment_method in (
      'unassigned',
      'email_auto',
      'manual',
      'metadata',
      'company_auto'
    )
  );
