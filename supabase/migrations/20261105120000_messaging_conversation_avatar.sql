-- Store the other person's photo on Unipile-backed chats (LinkedIn, WhatsApp, etc.).
alter table public.messaging_conversations
  add column if not exists prospect_avatar_url text;

comment on column public.messaging_conversations.prospect_avatar_url is
  'Profile photo for the other person in the thread, usually from Unipile attendees or the linked contact.';
