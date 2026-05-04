-- Community calendar: staff read; admins insert/update/delete

create table if not exists public.community_calendar_events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  description text not null default '' check (char_length(description) <= 4000),
  cover_image_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  display_timezone text not null default 'UTC',
  location_kind text not null check (location_kind in ('link', 'in_person')),
  location_url text,
  is_recurring boolean not null default false,
  recurrence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_calendar_events_time_order check (ends_at > starts_at),
  constraint community_calendar_events_link_location check (
    location_kind <> 'link'
    or (
      location_url is not null
      and length(trim(location_url)) > 0
    )
  )
);

create index if not exists community_calendar_events_starts_at_idx
  on public.community_calendar_events (starts_at asc);

create or replace function public.community_calendar_events_touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists community_calendar_events_set_updated_at on public.community_calendar_events;
create trigger community_calendar_events_set_updated_at
  before update on public.community_calendar_events
  for each row execute procedure public.community_calendar_events_touch_updated_at();

alter table public.community_calendar_events enable row level security;

drop policy if exists "Staff read community_calendar_events" on public.community_calendar_events;
create policy "Staff read community_calendar_events"
  on public.community_calendar_events for select
  to authenticated
  using (public.is_staff_community());

drop policy if exists "Admin insert community_calendar_events" on public.community_calendar_events;
create policy "Admin insert community_calendar_events"
  on public.community_calendar_events for insert
  to authenticated
  with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "Admin update community_calendar_events" on public.community_calendar_events;
create policy "Admin update community_calendar_events"
  on public.community_calendar_events for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin delete community_calendar_events" on public.community_calendar_events;
create policy "Admin delete community_calendar_events"
  on public.community_calendar_events for delete
  to authenticated
  using (public.is_admin());
