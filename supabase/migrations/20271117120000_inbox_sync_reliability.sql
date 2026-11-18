-- Inbox sync that never fails (job 229).
-- Additive only: per-account sync markers, a per-coach lock, a run log,
-- and a seen-list so the support mailbox stops re-fetching handled emails.

alter table public.linkedin_outreach_accounts
  -- Newest point this account is fully synced to (start time of the last
  -- run that finished). Quick syncs only ask for items after this, minus
  -- an overlap.
  add column if not exists sync_cursor_at timestamptz,
  -- Provider said "too many requests": skip this account until then.
  add column if not exists sync_backoff_until timestamptz,
  -- Last run that finished with nothing left to fetch.
  add column if not exists last_sync_finished_at timestamptz,
  add column if not exists last_sync_error text;

-- One sync at a time per coach (two tabs, cron + button).
create table if not exists public.inbox_sync_locks (
  coach_id uuid primary key,
  holder text not null,
  locked_until timestamptz not null
);
alter table public.inbox_sync_locks enable row level security;

create or replace function public.try_inbox_sync_lock(
  p_coach_id uuid,
  p_holder text,
  p_ttl_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  got boolean;
begin
  insert into public.inbox_sync_locks (coach_id, holder, locked_until)
  values (p_coach_id, p_holder, now() + make_interval(secs => p_ttl_seconds))
  on conflict (coach_id) do update
    set holder = excluded.holder,
        locked_until = excluded.locked_until
    where public.inbox_sync_locks.locked_until < now()
  returning true into got;
  return coalesce(got, false);
end;
$$;

create or replace function public.release_inbox_sync_lock(
  p_coach_id uuid,
  p_holder text
) returns void
language sql
security definer
set search_path = public
as $$
  delete from public.inbox_sync_locks
  where coach_id = p_coach_id and holder = p_holder;
$$;

revoke all on function public.try_inbox_sync_lock(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.release_inbox_sync_lock(uuid, text) from public, anon, authenticated;

-- One row per account per run: how long, did it finish, what went wrong.
create table if not exists public.inbox_sync_runs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null,
  account_id uuid,
  provider text,
  trigger text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  complete boolean not null default false,
  chats integer not null default 0,
  messages integer not null default 0,
  outcome text,
  error text
);
create index if not exists inbox_sync_runs_coach_started_idx
  on public.inbox_sync_runs (coach_id, started_at desc);
create index if not exists inbox_sync_runs_started_idx
  on public.inbox_sync_runs (started_at desc);
alter table public.inbox_sync_runs enable row level security;

-- Support mailbox: emails already handled, so the minute cron skips them
-- without fetching the full email again.
create table if not exists public.support_mailbox_seen_emails (
  email_id text primary key,
  outcome text,
  seen_at timestamptz not null default now()
);
alter table public.support_mailbox_seen_emails enable row level security;

-- Support mailbox: newest point fully checked, so the minute cron lists only
-- newer emails (a full list of 25 took 10-20s).
alter table public.platform_unipile_accounts
  add column if not exists sync_cursor_at timestamptz;
