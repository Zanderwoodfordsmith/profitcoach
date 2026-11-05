-- Ava's chats (5 Nov): the person can delete a chat from their list. It is
-- hidden, not erased, so what it cost (ai_usage) still adds up. Hidden from
-- BCA's view of a coach's chats too. Additive only.

alter table public.ai_agent_chats
  add column if not exists deleted_at timestamptz;
