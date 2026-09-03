-- LinkedIn outreach campaigns (Unipile) + Conversations linkedin channel.

-- Allow LinkedIn as a messaging channel
alter table public.messaging_messages
  drop constraint if exists messaging_messages_channel_check;

alter table public.messaging_messages
  add constraint messaging_messages_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'voice', 'system', 'linkedin'));

alter table public.messaging_conversations
  add column if not exists unipile_chat_id text,
  add column if not exists unipile_account_id text;

create unique index if not exists messaging_conversations_coach_unipile_chat_uidx
  on public.messaging_conversations (coach_id, unipile_chat_id)
  where unipile_chat_id is not null;

alter table public.messaging_messages
  add column if not exists unipile_message_id text;

create unique index if not exists messaging_messages_unipile_message_uidx
  on public.messaging_messages (unipile_message_id)
  where unipile_message_id is not null;

-- Connected LinkedIn accounts via Unipile (per coach)
create table if not exists public.linkedin_outreach_accounts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  unipile_account_id text not null,
  provider text not null default 'LINKEDIN',
  status text not null default 'OK'
    check (status in ('OK', 'CONNECTING', 'CREDENTIALS', 'STOPPED', 'ERROR')),
  display_name text,
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, unipile_account_id)
);

create index if not exists linkedin_outreach_accounts_coach_idx
  on public.linkedin_outreach_accounts (coach_id);

-- Campaigns
create table if not exists public.linkedin_campaigns (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  outreach_account_id uuid references public.linkedin_outreach_accounts (id) on delete set null,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'running', 'paused', 'completed', 'archived')),
  daily_invite_limit int not null default 20 check (daily_invite_limit > 0 and daily_invite_limit <= 50),
  min_action_delay_seconds int not null default 180 check (min_action_delay_seconds >= 60),
  quiet_hours_start int check (quiet_hours_start is null or (quiet_hours_start >= 0 and quiet_hours_start <= 23)),
  quiet_hours_end int check (quiet_hours_end is null or (quiet_hours_end >= 0 and quiet_hours_end <= 23)),
  timezone text not null default 'Europe/London',
  stop_on_reply boolean not null default true,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkedin_campaigns_coach_status_idx
  on public.linkedin_campaigns (coach_id, status);

-- Sequence steps (invite / message / wait)
create table if not exists public.linkedin_campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.linkedin_campaigns (id) on delete cascade,
  position int not null check (position >= 0),
  step_type text not null check (step_type in ('invite', 'message', 'wait')),
  body text,
  wait_hours numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, position)
);

create index if not exists linkedin_campaign_steps_campaign_idx
  on public.linkedin_campaign_steps (campaign_id, position);

-- Audience / enrollments
create table if not exists public.linkedin_campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.linkedin_campaigns (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  linkedin_url text,
  linkedin_provider_id text,
  first_name text,
  last_name text,
  company text,
  title text,
  status text not null default 'queued'
    check (status in (
      'queued', 'invited', 'connected', 'in_sequence', 'replied',
      'completed', 'failed', 'paused', 'skipped'
    )),
  current_step_position int not null default 0,
  next_action_at timestamptz,
  last_error text,
  unipile_chat_id text,
  invitation_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkedin_campaign_leads_campaign_status_idx
  on public.linkedin_campaign_leads (campaign_id, status);

create index if not exists linkedin_campaign_leads_next_action_idx
  on public.linkedin_campaign_leads (status, next_action_at)
  where next_action_at is not null;

create unique index if not exists linkedin_campaign_leads_campaign_url_uidx
  on public.linkedin_campaign_leads (campaign_id, linkedin_url)
  where linkedin_url is not null;

-- Atomic send jobs
create table if not exists public.linkedin_send_jobs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  campaign_id uuid not null references public.linkedin_campaigns (id) on delete cascade,
  lead_id uuid not null references public.linkedin_campaign_leads (id) on delete cascade,
  step_id uuid not null references public.linkedin_campaign_steps (id) on delete cascade,
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts int not null default 0,
  provider_ref text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkedin_send_jobs_due_idx
  on public.linkedin_send_jobs (status, scheduled_for);

create index if not exists linkedin_send_jobs_campaign_idx
  on public.linkedin_send_jobs (campaign_id, status);

-- updated_at triggers
create or replace function public.set_linkedin_outreach_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_linkedin_outreach_accounts_updated_at on public.linkedin_outreach_accounts;
create trigger trg_linkedin_outreach_accounts_updated_at
before update on public.linkedin_outreach_accounts
for each row execute function public.set_linkedin_outreach_updated_at();

drop trigger if exists trg_linkedin_campaigns_updated_at on public.linkedin_campaigns;
create trigger trg_linkedin_campaigns_updated_at
before update on public.linkedin_campaigns
for each row execute function public.set_linkedin_outreach_updated_at();

drop trigger if exists trg_linkedin_campaign_steps_updated_at on public.linkedin_campaign_steps;
create trigger trg_linkedin_campaign_steps_updated_at
before update on public.linkedin_campaign_steps
for each row execute function public.set_linkedin_outreach_updated_at();

drop trigger if exists trg_linkedin_campaign_leads_updated_at on public.linkedin_campaign_leads;
create trigger trg_linkedin_campaign_leads_updated_at
before update on public.linkedin_campaign_leads
for each row execute function public.set_linkedin_outreach_updated_at();

drop trigger if exists trg_linkedin_send_jobs_updated_at on public.linkedin_send_jobs;
create trigger trg_linkedin_send_jobs_updated_at
before update on public.linkedin_send_jobs
for each row execute function public.set_linkedin_outreach_updated_at();

-- RLS: service role / API uses supabaseAdmin; enable for defense in depth
alter table public.linkedin_outreach_accounts enable row level security;
alter table public.linkedin_campaigns enable row level security;
alter table public.linkedin_campaign_steps enable row level security;
alter table public.linkedin_campaign_leads enable row level security;
alter table public.linkedin_send_jobs enable row level security;

create policy "Coaches read own linkedin outreach accounts"
  on public.linkedin_outreach_accounts for select
  using (auth.uid() = coach_id);

create policy "Admins read all linkedin outreach accounts"
  on public.linkedin_outreach_accounts for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Coaches read own linkedin campaigns"
  on public.linkedin_campaigns for select
  using (auth.uid() = coach_id);

create policy "Admins read all linkedin campaigns"
  on public.linkedin_campaigns for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Coaches read own linkedin campaign steps"
  on public.linkedin_campaign_steps for select
  using (
    exists (
      select 1 from public.linkedin_campaigns c
      where c.id = campaign_id and c.coach_id = auth.uid()
    )
  );

create policy "Admins read all linkedin campaign steps"
  on public.linkedin_campaign_steps for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Coaches read own linkedin campaign leads"
  on public.linkedin_campaign_leads for select
  using (auth.uid() = coach_id);

create policy "Admins read all linkedin campaign leads"
  on public.linkedin_campaign_leads for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Coaches read own linkedin send jobs"
  on public.linkedin_send_jobs for select
  using (auth.uid() = coach_id);

create policy "Admins read all linkedin send jobs"
  on public.linkedin_send_jobs for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
