alter table public.messaging_conversations
  add column if not exists hidden_at timestamptz;

create index if not exists messaging_conversations_coach_hidden_idx
  on public.messaging_conversations (coach_id, hidden_at);

comment on column public.messaging_conversations.hidden_at is
  'When set, the thread is removed from the inbox without deleting Unipile/provider history.';
