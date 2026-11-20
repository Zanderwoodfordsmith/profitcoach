-- "Seen" on messages we send through Unipile (WhatsApp, LinkedIn): set when
-- Unipile's message_read webhook says the other person read it.
alter table public.messaging_messages
  add column if not exists read_at timestamptz;

alter table public.community_feedback_replies
  add column if not exists whatsapp_read_at timestamptz;
