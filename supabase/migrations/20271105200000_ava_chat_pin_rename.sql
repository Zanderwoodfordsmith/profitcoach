-- Ava's chats (5 Nov): pin a chat to the top of the list, and rename it.
-- A chat the person renamed keeps their name: Ava stops retitling it as it
-- goes on. Additive only.

alter table public.ai_agent_chats
  add column if not exists pinned_at timestamptz,
  add column if not exists renamed_at timestamptz;
