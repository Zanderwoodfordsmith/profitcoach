create table if not exists public.coach_payments (
  id uuid primary key default gen_random_uuid(),
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text,
  customer_email text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'gbp',
  status text not null default 'succeeded' check (status in ('succeeded', 'pending', 'failed', 'refunded')),
  paid_at timestamptz not null default now(),
  coach_id uuid references public.coaches (id) on delete set null,
  assignment_method text not null default 'unassigned' check (assignment_method in ('unassigned', 'email_auto', 'manual', 'metadata')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_payments_coach_id_paid_at_idx
  on public.coach_payments (coach_id, paid_at desc);

create index if not exists coach_payments_email_idx
  on public.coach_payments ((lower(customer_email)));

create or replace function public.set_coach_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coach_payments_updated_at on public.coach_payments;
create trigger trg_coach_payments_updated_at
before update on public.coach_payments
for each row execute function public.set_coach_payments_updated_at();
