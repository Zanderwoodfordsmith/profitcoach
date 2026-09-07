-- Denormalize latest message direction for inbox "Needs reply" filtering.
alter table public.messaging_conversations
  add column if not exists last_direction text
  check (last_direction is null or last_direction in ('inbound', 'outbound'));

comment on column public.messaging_conversations.last_direction is
  'Direction of the latest message (inbound/outbound). Used for Needs reply filters.';

create index if not exists messaging_conversations_needs_reply_idx
  on public.messaging_conversations (coach_id, last_message_at desc)
  where last_direction = 'inbound' and hidden_at is null;

-- Backfill from the newest message per thread.
update public.messaging_conversations c
set last_direction = m.direction
from (
  select distinct on (conversation_id)
    conversation_id,
    direction
  from public.messaging_messages
  where direction in ('inbound', 'outbound')
  order by conversation_id, created_at desc
) m
where c.id = m.conversation_id
  and c.last_direction is distinct from m.direction;
