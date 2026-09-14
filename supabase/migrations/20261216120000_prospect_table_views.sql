-- Per-owner saved views for the prospects list (filters, sort, grouping, columns).

create table if not exists public.prospect_table_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  surface text not null check (surface in ('coach', 'admin')),
  name text not null,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prospect_table_views_name_len check (
    char_length(btrim(name)) between 1 and 80
  )
);

create index if not exists prospect_table_views_owner_surface_idx
  on public.prospect_table_views (owner_id, surface);

create unique index if not exists prospect_table_views_one_all_per_owner
  on public.prospect_table_views (owner_id, surface)
  where lower(btrim(name)) = 'all';

create table if not exists public.prospect_table_view_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  surface text not null check (surface in ('coach', 'admin')),
  active_view_id uuid references public.prospect_table_views (id) on delete set null,
  autosave boolean not null default false,
  view_order uuid[] not null default '{}'::uuid[],
  updated_at timestamptz not null default now(),
  primary key (user_id, surface)
);

alter table public.prospect_table_views enable row level security;
alter table public.prospect_table_view_preferences enable row level security;

drop policy if exists "Owners read own prospect table views"
  on public.prospect_table_views;
create policy "Owners read own prospect table views"
  on public.prospect_table_views
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Owners manage own prospect table views"
  on public.prospect_table_views;
create policy "Owners manage own prospect table views"
  on public.prospect_table_views
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners manage own prospect table view preferences"
  on public.prospect_table_view_preferences;
create policy "Owners manage own prospect table view preferences"
  on public.prospect_table_view_preferences
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
