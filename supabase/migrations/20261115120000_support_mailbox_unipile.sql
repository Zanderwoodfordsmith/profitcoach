-- Dedicated Unipile mailbox for Admin Support (not coach CRM).
-- Isolation: never write these accounts into linkedin_outreach_accounts.

create table if not exists public.platform_unipile_accounts (
  id uuid primary key default gen_random_uuid(),
  purpose text not null
    check (purpose in ('support')),
  unipile_account_id text not null,
  provider text not null,
  status text not null default 'OK'
    check (status in ('OK', 'CONNECTING', 'CREDENTIALS', 'STOPPED', 'ERROR')),
  display_name text,
  connected_by uuid references public.profiles (id) on delete set null,
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unipile_account_id),
  unique (purpose)
);

create index if not exists platform_unipile_accounts_unipile_id_idx
  on public.platform_unipile_accounts (unipile_account_id);

alter table public.platform_unipile_accounts enable row level security;

-- Service role / admin APIs only; no coach client access.
drop policy if exists platform_unipile_accounts_no_client on public.platform_unipile_accounts;
create policy platform_unipile_accounts_no_client
  on public.platform_unipile_accounts
  for all
  using (false)
  with check (false);

-- Support tickets from the dedicated mailbox
alter table public.community_feedback_reports
  drop constraint if exists community_feedback_reports_source_check;

alter table public.community_feedback_reports
  add constraint community_feedback_reports_source_check
  check (
    source is null
    or source in (
      'direct',
      'lesson_private',
      'public_form',
      'admin_created',
      'email_inbox'
    )
  );

alter table public.community_feedback_reports
  add column if not exists unipile_email_id text,
  add column if not exists unipile_thread_id text,
  add column if not exists unipile_account_id text;

create unique index if not exists community_feedback_reports_unipile_email_id_uidx
  on public.community_feedback_reports (unipile_email_id)
  where unipile_email_id is not null;

create index if not exists community_feedback_reports_unipile_thread_id_idx
  on public.community_feedback_reports (unipile_thread_id)
  where unipile_thread_id is not null;
