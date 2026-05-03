-- Presence for community sidebar: last seen while on community (heartbeat).
-- Staff can read all rows; each user may insert/update only their own row.

create table if not exists public.community_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists community_presence_last_seen_idx
  on public.community_presence (last_seen_at desc);

alter table public.community_presence enable row level security;

grant select, insert, update on public.community_presence to authenticated;

drop policy if exists "Staff read community_presence" on public.community_presence;
create policy "Staff read community_presence"
  on public.community_presence for select
  to authenticated
  using (public.is_staff_community());

drop policy if exists "Staff insert own community_presence" on public.community_presence;
create policy "Staff insert own community_presence"
  on public.community_presence for insert
  to authenticated
  with check (public.is_staff_community() and user_id = auth.uid());

drop policy if exists "Staff update own community_presence" on public.community_presence;
create policy "Staff update own community_presence"
  on public.community_presence for update
  to authenticated
  using (public.is_staff_community() and user_id = auth.uid())
  with check (public.is_staff_community() and user_id = auth.uid());
