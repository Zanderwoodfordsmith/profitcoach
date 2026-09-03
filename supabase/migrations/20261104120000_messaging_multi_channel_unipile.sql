-- Multi-channel Unipile: Instagram + Messenger as messaging channels.
-- email / whatsapp / linkedin already allowed.

alter table public.messaging_messages
  drop constraint if exists messaging_messages_channel_check;

alter table public.messaging_messages
  add constraint messaging_messages_channel_check
  check (
    channel in (
      'email',
      'sms',
      'whatsapp',
      'voice',
      'system',
      'linkedin',
      'instagram',
      'messenger'
    )
  );
