-- Shared admin coach table views (filters, sort, columns) with optional private views.

create table if not exists public.admin_coach_table_views (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  is_private boolean not null default false,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_coach_table_views_created_by_idx
  on public.admin_coach_table_views (created_by);

create index if not exists admin_coach_table_views_visibility_idx
  on public.admin_coach_table_views (is_private, created_by);

create table if not exists public.admin_coach_table_view_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  active_view_id uuid references public.admin_coach_table_views (id) on delete set null,
  autosave boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.admin_coach_table_views enable row level security;
alter table public.admin_coach_table_view_preferences enable row level security;

drop policy if exists "Admins read coach table views"
  on public.admin_coach_table_views;
create policy "Admins read coach table views"
  on public.admin_coach_table_views
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    and (
      not is_private
      or created_by = auth.uid()
    )
  );

drop policy if exists "Admins manage own coach table views"
  on public.admin_coach_table_views;
create policy "Admins manage own coach table views"
  on public.admin_coach_table_views
  for all
  to authenticated
  using (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins manage own coach table view preferences"
  on public.admin_coach_table_view_preferences;
create policy "Admins manage own coach table view preferences"
  on public.admin_coach_table_view_preferences
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
