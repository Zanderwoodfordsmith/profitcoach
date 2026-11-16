-- Inbox "Replied" filter: the person has written back at least once.
-- Unlike last_direction, this stays true after the coach answers.
alter table public.messaging_conversations
  add column if not exists has_inbound boolean not null default false;

comment on column public.messaging_conversations.has_inbound is
  'True once the thread has any inbound message. Used for the inbox Replied filter.';

create or replace function public.mark_messaging_conversation_has_inbound()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messaging_conversations
  set has_inbound = true
  where id = new.conversation_id
    and has_inbound = false;
  return new;
end;
$$;

drop trigger if exists messaging_messages_mark_has_inbound on public.messaging_messages;
create trigger messaging_messages_mark_has_inbound
  after insert or update of conversation_id, direction on public.messaging_messages
  for each row
  when (new.direction = 'inbound')
  execute function public.mark_messaging_conversation_has_inbound();

-- Backfill every thread that already has a reply.
update public.messaging_conversations c
set has_inbound = true
where c.has_inbound = false
  and exists (
    select 1
    from public.messaging_messages m
    where m.conversation_id = c.id
      and m.direction = 'inbound'
  );
