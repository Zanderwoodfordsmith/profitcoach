-- Ava copilot + autopilot for replies, phone push alerts, BCA alerts WhatsApp.
-- Additive. Autopilot is OFF everywhere: it needs the global flag, an admin
-- allow per coach, and the coach switching it on.

-- 1. Per-coach Ava reply settings.
create table if not exists public.coach_ava_settings (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  reply_mode text not null default 'copilot' check (reply_mode in ('off', 'copilot', 'autopilot')),
  autopilot_allowed boolean not null default false,
  autopilot_min_confidence numeric(4, 3) not null default 0.85
    check (autopilot_min_confidence >= 0.5 and autopilot_min_confidence <= 1),
  notify_push boolean not null default true,
  notify_whatsapp boolean not null default true,
  notify_email boolean not null default false,
  quiet_start smallint not null default 21 check (quiet_start between 0 and 23),
  quiet_end smallint not null default 7 check (quiet_end between 0 and 23),
  updated_at timestamptz not null default now()
);

-- 2. Web push subscriptions (installed phone app / browser).
create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  failed_count int not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists web_push_subscriptions_user_idx on public.web_push_subscriptions (user_id);

-- 3. Triage rows remember what Ava did.
alter table public.ava_reply_triage
  add column if not exists mode text,
  add column if not exists offered_slots jsonb,
  add column if not exists scheduled_message_id uuid references public.messaging_scheduled_messages (id) on delete set null,
  add column if not exists sent_text text,
  add column if not exists alert_channels text[];

alter table public.ava_reply_triage drop constraint if exists ava_reply_triage_next_step_check;
alter table public.ava_reply_triage add constraint ava_reply_triage_next_step_check
  check (next_step in ('calendar', 'scorecard', 'answer', 'nurture', 'no_reply', 'human', 'confirm_time'));
alter table public.ava_reply_triage drop constraint if exists ava_reply_triage_admin_next_step_check;
alter table public.ava_reply_triage add constraint ava_reply_triage_admin_next_step_check
  check (admin_next_step in ('calendar', 'scorecard', 'answer', 'nurture', 'no_reply', 'human', 'confirm_time'));
alter table public.ava_reply_triage drop constraint if exists ava_reply_triage_status_check;
alter table public.ava_reply_triage add constraint ava_reply_triage_status_check
  check (status in ('open', 'sent', 'dismissed', 'autopilot_scheduled', 'autopilot_sent', 'autopilot_cancelled'));

-- 4. BCA's own WhatsApp for alerts lives beside the support mailbox.
alter table public.platform_unipile_accounts drop constraint if exists platform_unipile_accounts_purpose_check;
alter table public.platform_unipile_accounts add constraint platform_unipile_accounts_purpose_check
  check (purpose in ('support', 'alerts'));

-- 5. Global autopilot switch (off).
insert into public.app_runtime_flags (key, value)
values ('ava_autopilot', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;

alter table public.coach_ava_settings enable row level security;
alter table public.web_push_subscriptions enable row level security;
revoke all on public.coach_ava_settings from anon, authenticated;
revoke all on public.web_push_subscriptions from anon, authenticated;
grant all on public.coach_ava_settings to service_role;
grant all on public.web_push_subscriptions to service_role;
