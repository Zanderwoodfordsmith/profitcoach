-- Inbox UX fields: unread, starred, last message preview.
alter table public.messaging_conversations
  add column if not exists starred boolean not null default false,
  add column if not exists unread_count integer not null default 0,
  add column if not exists last_preview text,
  add column if not exists last_channel text;

create index if not exists messaging_conversations_starred_idx
  on public.messaging_conversations (coach_id, starred)
  where starred = true;

create index if not exists messaging_conversations_unread_idx
  on public.messaging_conversations (coach_id, unread_count)
  where unread_count > 0;

comment on column public.messaging_conversations.starred is
  'Coach starred this thread in the team inbox.';
comment on column public.messaging_conversations.unread_count is
  'Unread messages for the coach; cleared when the thread is opened.';
comment on column public.messaging_conversations.last_preview is
  'Short preview of the latest message body for the sidebar list.';
comment on column public.messaging_conversations.last_channel is
  'Channel of the latest message (email, sms, etc.).';
