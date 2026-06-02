-- Time Tracker (admin-only): weekly time-blocking grid.
-- Each admin owns their settings + blocks; any admin can read the whole team's
-- blocks (read-only) but only write their own.

-- Per-admin grid settings: when the day starts and how many hours are shown.
create table if not exists public.time_tracker_settings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_start_min integer not null default 360, -- minutes from midnight (06:00)
  visible_hours integer not null default 18,
  slot_minutes integer not null default 15,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  check (day_start_min >= 0 and day_start_min < 1440),
  check (visible_hours >= 1 and visible_hours <= 24),
  check (slot_minutes in (5, 10, 15, 30, 60))
);

alter table public.time_tracker_settings enable row level security;

-- Any admin can read all admins' settings (team view).
drop policy if exists "Admins read time tracker settings"
  on public.time_tracker_settings;
create policy "Admins read time tracker settings"
  on public.time_tracker_settings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins manage own time tracker settings"
  on public.time_tracker_settings;
create policy "Admins manage own time tracker settings"
  on public.time_tracker_settings
  for all
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Individual scheduled blocks. start_min/end_min are minutes from midnight on
-- day_date; end_min is exclusive so a block can span (merge) multiple slots.
create table if not exists public.time_tracker_block (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_date date not null,
  start_min integer not null,
  end_min integer not null,
  title text not null default '',
  notes text not null default '',
  rating text not null default 'unset',
  category text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_min >= 0 and start_min < 1440),
  check (end_min > start_min and end_min <= 1440),
  check (rating in ('good', 'bad', 'neutral', 'unset'))
);

create index if not exists time_tracker_block_user_day_idx
  on public.time_tracker_block (user_id, day_date);

alter table public.time_tracker_block enable row level security;

-- Any admin can read all admins' blocks (team view).
drop policy if exists "Admins read time tracker blocks"
  on public.time_tracker_block;
create policy "Admins read time tracker blocks"
  on public.time_tracker_block
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins insert own time tracker blocks"
  on public.time_tracker_block;
create policy "Admins insert own time tracker blocks"
  on public.time_tracker_block
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins update own time tracker blocks"
  on public.time_tracker_block;
create policy "Admins update own time tracker blocks"
  on public.time_tracker_block
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Admins delete own time tracker blocks"
  on public.time_tracker_block;
create policy "Admins delete own time tracker blocks"
  on public.time_tracker_block
  for delete
  to authenticated
  using (user_id = auth.uid());
