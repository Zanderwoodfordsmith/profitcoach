-- GHL appointment webhooks: store booking lifecycle and link to coaches/contacts.

alter table public.coaches
  add column if not exists ghl_calendar_id text;

comment on column public.coaches.ghl_calendar_id is
  'GHL calendar / booking widget id; auto-extracted from calendar_embed_code when saved.';

create table if not exists public.ghl_appointments (
  id uuid primary key default gen_random_uuid(),
  ghl_appointment_id text not null,
  ghl_location_id text,
  ghl_calendar_id text,
  coach_id uuid references public.coaches (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  assessment_id uuid references public.assessments (id) on delete set null,
  prospect_email text,
  prospect_phone text,
  prospect_name text,
  calendar_name text,
  title text,
  status_raw text,
  status_normalized text not null default 'other' check (
    status_normalized in (
      'booked',
      'confirmed',
      'cancelled',
      'showed',
      'noshow',
      'invalid',
      'other'
    )
  ),
  start_time timestamptz,
  end_time timestamptz,
  timezone text,
  notes text,
  address text,
  match_status text not null default 'unmatched_coach' check (
    match_status in ('matched', 'unmatched_contact', 'unmatched_coach')
  ),
  raw_payload jsonb not null default '{}'::jsonb,
  webhook_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ghl_appointments_ghl_appointment_id_key unique (ghl_appointment_id)
);

create index if not exists ghl_appointments_coach_start_idx
  on public.ghl_appointments (coach_id, start_time desc);

create index if not exists ghl_appointments_coach_status_idx
  on public.ghl_appointments (coach_id, status_normalized);

create index if not exists ghl_appointments_prospect_email_idx
  on public.ghl_appointments ((lower(prospect_email)));

comment on table public.ghl_appointments is
  'Appointment rows synced from GHL Appointment Status Changed webhooks.';

create or replace function public.set_ghl_appointments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ghl_appointments_updated_at on public.ghl_appointments;
create trigger trg_ghl_appointments_updated_at
before update on public.ghl_appointments
for each row execute function public.set_ghl_appointments_updated_at();

alter table public.ghl_appointments enable row level security;

-- Webhook writes use service_role (bypasses RLS). Coaches/admins read for future UI.
create policy "Coaches read own ghl appointments"
  on public.ghl_appointments
  for select
  using (coach_id = auth.uid());

create policy "Admins read all ghl appointments"
  on public.ghl_appointments
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
