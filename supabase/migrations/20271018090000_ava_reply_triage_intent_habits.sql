-- Ava reply copilot, intent signals and the 1-10-10 daily habit.
-- Additive only. All three tables are server-side (service role); coaches reach
-- them through API routes that scope by coach_id.

-- 1. Reply triage: one row per inbound message Ava has read.
--    Ava classifies the reply, recommends the next step, drafts a reply and
--    alerts the coach. Admins label rows so we can measure accuracy before any
--    reply is ever sent automatically (autopilot is NOT built; nothing here sends).
create table if not exists public.ava_reply_triage (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  conversation_id uuid not null references public.messaging_conversations (id) on delete cascade,
  message_id uuid references public.messaging_messages (id) on delete set null,
  channel text,
  inbound_text text not null default '',
  inbound_at timestamptz,
  disposition text check (disposition in ('interested', 'neutral', 'not_interested')),
  situation text,
  next_step text check (next_step in ('calendar', 'scorecard', 'answer', 'nurture', 'no_reply', 'human')),
  confidence numeric(4, 3),
  reason text,
  draft text,
  model text,
  alert_sent_at timestamptz,
  status text not null default 'open' check (status in ('open', 'sent', 'dismissed')),
  admin_disposition text check (admin_disposition in ('interested', 'neutral', 'not_interested')),
  admin_next_step text check (admin_next_step in ('calendar', 'scorecard', 'answer', 'nurture', 'no_reply', 'human')),
  admin_note text,
  admin_labelled_by uuid references public.profiles (id) on delete set null,
  admin_labelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);

create index if not exists ava_reply_triage_coach_idx
  on public.ava_reply_triage (coach_id, created_at desc);
create index if not exists ava_reply_triage_review_idx
  on public.ava_reply_triage (disposition, admin_labelled_at, created_at desc);

-- 2. Intent signals: people who showed interest without being messaged
--    (engaged on a post, sent a connection request).
create table if not exists public.coach_intent_signals (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  kind text not null check (kind in ('post_comment', 'post_reaction', 'invite_received', 'profile_view')),
  provider_id text not null,
  name text,
  headline text,
  profile_url text,
  context text,
  signal_at timestamptz,
  opener text,
  status text not null default 'new' check (status in ('new', 'messaged', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, kind, provider_id)
);

create index if not exists coach_intent_signals_coach_idx
  on public.coach_intent_signals (coach_id, status, signal_at desc);

-- 3. Daily habit: 1 post, 10 comments, 10 DMs each weekday.
--    Posts and DMs are counted from activity; comments are logged by the coach.
create table if not exists public.coach_daily_habits (
  coach_id uuid not null references public.coaches (id) on delete cascade,
  day date not null,
  comments_logged int not null default 0 check (comments_logged >= 0 and comments_logged <= 500),
  posts_logged int not null default 0 check (posts_logged >= 0 and posts_logged <= 50),
  updated_at timestamptz not null default now(),
  primary key (coach_id, day)
);

alter table public.ava_reply_triage enable row level security;
alter table public.coach_intent_signals enable row level security;
alter table public.coach_daily_habits enable row level security;

revoke all on public.ava_reply_triage from anon, authenticated;
revoke all on public.coach_intent_signals from anon, authenticated;
revoke all on public.coach_daily_habits from anon, authenticated;
grant all on public.ava_reply_triage to service_role;
grant all on public.coach_intent_signals to service_role;
grant all on public.coach_daily_habits to service_role;
