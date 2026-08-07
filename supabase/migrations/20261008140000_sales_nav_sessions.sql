-- Per-user LinkedIn Sales Navigator cookie session (from Chrome extension or paste).

create table if not exists public.sales_nav_sessions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  cookie_json text not null,
  user_agent text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.sales_nav_sessions enable row level security;

-- No direct client access; API uses service role.
drop policy if exists "No direct access sales_nav_sessions"
  on public.sales_nav_sessions;
create policy "No direct access sales_nav_sessions"
  on public.sales_nav_sessions
  for all
  to authenticated
  using (false)
  with check (false);
