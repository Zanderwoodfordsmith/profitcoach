-- Client coaching sessions: manual logs + notes linked to booked/GHL calls.
-- Also enrich contacts with LinkedIn-imported profile photo / headline / location.

alter table public.contacts
  add column if not exists photo_url text,
  add column if not exists headline text,
  add column if not exists location text;

comment on column public.contacts.photo_url is
  'Optional profile photo URL (e.g. LinkedIn import).';
comment on column public.contacts.headline is
  'Optional headline / title line (e.g. LinkedIn).';
comment on column public.contacts.location is
  'Optional location string (e.g. LinkedIn).';

create table if not exists public.client_coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  ghl_appointment_id uuid references public.ghl_appointments (id) on delete set null,
  title text not null default 'Coaching session',
  session_type text not null default 'coaching',
  starts_at timestamptz not null,
  ends_at timestamptz,
  source text not null default 'manual'
    check (source in ('manual', 'booking', 'ghl')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_coaching_sessions_booking_or_ghl_or_manual check (
    (source = 'manual' and booking_id is null and ghl_appointment_id is null)
    or (source = 'booking' and booking_id is not null)
    or (source = 'ghl' and ghl_appointment_id is not null)
  )
);

create unique index if not exists client_coaching_sessions_booking_uidx
  on public.client_coaching_sessions (booking_id)
  where booking_id is not null;

create unique index if not exists client_coaching_sessions_ghl_uidx
  on public.client_coaching_sessions (ghl_appointment_id)
  where ghl_appointment_id is not null;

create index if not exists client_coaching_sessions_contact_starts_idx
  on public.client_coaching_sessions (contact_id, starts_at desc);

create index if not exists client_coaching_sessions_coach_starts_idx
  on public.client_coaching_sessions (coach_id, starts_at desc);

comment on table public.client_coaching_sessions is
  'Coaching sessions for clients: manually logged or notes attached to booked/GHL calls.';

create or replace function public.set_client_coaching_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_client_coaching_sessions_updated_at
  on public.client_coaching_sessions;
create trigger trg_client_coaching_sessions_updated_at
before update on public.client_coaching_sessions
for each row execute function public.set_client_coaching_sessions_updated_at();

alter table public.client_coaching_sessions enable row level security;

drop policy if exists "Coaches read own client coaching sessions"
  on public.client_coaching_sessions;
create policy "Coaches read own client coaching sessions"
  on public.client_coaching_sessions for select
  using (coach_id = auth.uid());

drop policy if exists "Coaches insert own client coaching sessions"
  on public.client_coaching_sessions;
create policy "Coaches insert own client coaching sessions"
  on public.client_coaching_sessions for insert
  with check (coach_id = auth.uid());

drop policy if exists "Coaches update own client coaching sessions"
  on public.client_coaching_sessions;
create policy "Coaches update own client coaching sessions"
  on public.client_coaching_sessions for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Coaches delete own client coaching sessions"
  on public.client_coaching_sessions;
create policy "Coaches delete own client coaching sessions"
  on public.client_coaching_sessions for delete
  using (coach_id = auth.uid());

drop policy if exists "Admins read all client coaching sessions"
  on public.client_coaching_sessions;
create policy "Admins read all client coaching sessions"
  on public.client_coaching_sessions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins write all client coaching sessions"
  on public.client_coaching_sessions;
create policy "Admins write all client coaching sessions"
  on public.client_coaching_sessions for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
