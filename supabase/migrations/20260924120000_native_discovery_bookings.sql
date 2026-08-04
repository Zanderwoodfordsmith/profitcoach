-- Native discovery booking: coach availability + owned bookings (system of record).

create table if not exists public.coach_booking_settings (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  timezone text not null default 'Europe/London',
  meeting_duration_minutes integer not null default 15
    check (meeting_duration_minutes > 0 and meeting_duration_minutes <= 180),
  buffer_minutes integer not null default 0
    check (buffer_minutes >= 0 and buffer_minutes <= 120),
  min_notice_hours integer not null default 24
    check (min_notice_hours >= 0 and min_notice_hours <= 168),
  booking_window_days integer not null default 14
    check (booking_window_days >= 1 and booking_window_days <= 90),
  is_enabled boolean not null default false,
  title text not null default '15-Minute Discovery Call',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coach_booking_settings is
  'Per-coach native booking defaults (duration, timezone, notice). Disabled until coach enables.';

create table if not exists public.coach_availability_rules (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint coach_availability_rules_range check (start_time < end_time)
);

create index if not exists coach_availability_rules_coach_weekday_idx
  on public.coach_availability_rules (coach_id, weekday);

comment on table public.coach_availability_rules is
  'Weekly availability windows; times are local to coach_booking_settings.timezone. weekday: 0=Sun…6=Sat.';

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  kind text not null default 'discovery',
  status text not null default 'booked' check (
    status in ('booked', 'cancelled', 'completed', 'noshow')
  ),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prospect_timezone text,
  prospect_name text,
  prospect_email text,
  prospect_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_range check (starts_at < ends_at)
);

create unique index if not exists bookings_coach_starts_booked_uidx
  on public.bookings (coach_id, starts_at)
  where status = 'booked';

create index if not exists bookings_coach_starts_idx
  on public.bookings (coach_id, starts_at desc);

create index if not exists bookings_prospect_email_idx
  on public.bookings ((lower(prospect_email)));

comment on table public.bookings is
  'Native bookings owned by the app (discovery now; other kinds later).';

create or replace function public.set_coach_booking_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coach_booking_settings_updated_at on public.coach_booking_settings;
create trigger trg_coach_booking_settings_updated_at
before update on public.coach_booking_settings
for each row execute function public.set_coach_booking_settings_updated_at();

create or replace function public.set_bookings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
before update on public.bookings
for each row execute function public.set_bookings_updated_at();

alter table public.coach_booking_settings enable row level security;
alter table public.coach_availability_rules enable row level security;
alter table public.bookings enable row level security;

create policy "Coaches read own booking settings"
  on public.coach_booking_settings for select
  using (coach_id = auth.uid());

create policy "Coaches write own booking settings"
  on public.coach_booking_settings for insert
  with check (coach_id = auth.uid());

create policy "Coaches update own booking settings"
  on public.coach_booking_settings for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Admins read all booking settings"
  on public.coach_booking_settings for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins write all booking settings"
  on public.coach_booking_settings for all
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

create policy "Coaches read own availability rules"
  on public.coach_availability_rules for select
  using (coach_id = auth.uid());

create policy "Coaches insert own availability rules"
  on public.coach_availability_rules for insert
  with check (coach_id = auth.uid());

create policy "Coaches update own availability rules"
  on public.coach_availability_rules for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Coaches delete own availability rules"
  on public.coach_availability_rules for delete
  using (coach_id = auth.uid());

create policy "Admins manage all availability rules"
  on public.coach_availability_rules for all
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

create policy "Coaches read own bookings"
  on public.bookings for select
  using (coach_id = auth.uid());

create policy "Coaches update own bookings"
  on public.bookings for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Admins read all bookings"
  on public.bookings for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins update all bookings"
  on public.bookings for update
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
