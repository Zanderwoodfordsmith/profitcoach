-- Blueprint page chat gets Support's message tools (5 Nov): images, files,
-- voice notes and video on a message, and BCA can schedule a message and
-- email the coach about it. Additive only.

alter table public.practice_section_comments
  add column if not exists media jsonb;

comment on column public.practice_section_comments.media is
  'Attachments, the same shape as support replies: [{ url, kind: image|video|audio|file, name?, poster? }].';

-- Messages BCA has written to send later. The every-minute support cron
-- posts them into practice_section_comments when due.
create table if not exists public.practice_scheduled_comments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  section_key text not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  media jsonb,
  email_notify boolean not null default false,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  comment_id uuid references public.practice_section_comments(id) on delete set null,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists practice_scheduled_comments_due
  on public.practice_scheduled_comments (status, scheduled_for);
create index if not exists practice_scheduled_comments_coach
  on public.practice_scheduled_comments (coach_id, section_key);

-- Server only (service role), like practice_section_comments.
alter table public.practice_scheduled_comments enable row level security;
