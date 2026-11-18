-- Zander's and Pam's own WhatsApp in Support (18 Nov 2026).
-- Each BCA admin can link their own WhatsApp. Only one-to-one chats with a
-- number that matches exactly one coach's profile phone are kept; every
-- other chat (family, friends, prospects, groups) is never stored.

create table if not exists public.support_whatsapp_lines (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null unique references public.profiles (id) on delete cascade,
  unipile_account_id text not null unique,
  phone text,
  status text not null default 'OK',
  display_name text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_whatsapp_lines enable row level security;
drop policy if exists support_whatsapp_lines_no_client on public.support_whatsapp_lines;
create policy support_whatsapp_lines_no_client
  on public.support_whatsapp_lines
  for all
  using (false)
  with check (false);

-- One row per (line, coach chat): where the next message from that coach goes.
create table if not exists public.support_whatsapp_chats (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.support_whatsapp_lines (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  unipile_chat_id text not null,
  last_report_id uuid references public.community_feedback_reports (id) on delete set null,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (line_id, unipile_chat_id),
  unique (line_id, coach_id)
);

alter table public.support_whatsapp_chats enable row level security;
drop policy if exists support_whatsapp_chats_no_client on public.support_whatsapp_chats;
create policy support_whatsapp_chats_no_client
  on public.support_whatsapp_chats
  for all
  using (false)
  with check (false);

-- Replies that came in or went out on WhatsApp.
alter table public.community_feedback_replies
  add column if not exists whatsapp_message_id text,
  add column if not exists whatsapp_with text;

create unique index if not exists community_feedback_replies_whatsapp_message_id_uidx
  on public.community_feedback_replies (whatsapp_message_id)
  where whatsapp_message_id is not null;

-- A scheduled reply can go out on WhatsApp too.
alter table public.support_scheduled_replies
  add column if not exists whatsapp_notify boolean not null default false;

-- A coach's WhatsApp chat with BCA.
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
      'email_inbox',
      'whatsapp'
    )
  );

-- The WhatsApp message that opened a coach's WhatsApp chat (no double import).
alter table public.community_feedback_reports
  add column if not exists whatsapp_message_id text;

create unique index if not exists community_feedback_reports_whatsapp_message_id_uidx
  on public.community_feedback_reports (whatsapp_message_id)
  where whatsapp_message_id is not null;
