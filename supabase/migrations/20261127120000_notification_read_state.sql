-- Persist dashboard notification-bell read cutoffs per user so clearing
-- localStorage / switching browsers does not resurface the whole backlog as unread.

create table if not exists public.notification_read_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.notification_read_state enable row level security;

grant select, insert, update on public.notification_read_state to authenticated;

drop policy if exists "Users read own notification_read_state"
  on public.notification_read_state;
create policy "Users read own notification_read_state"
  on public.notification_read_state for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users insert own notification_read_state"
  on public.notification_read_state;
create policy "Users insert own notification_read_state"
  on public.notification_read_state for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own notification_read_state"
  on public.notification_read_state;
create policy "Users update own notification_read_state"
  on public.notification_read_state for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
