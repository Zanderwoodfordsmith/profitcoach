-- PostgREST upserts send `ON CONFLICT (unipile_message_id)` with no predicate,
-- which Postgres cannot match to a partial unique index (42P10). Every Unipile
-- webhook message insert was failing. A full unique index still allows many NULLs.

create unique index if not exists messaging_messages_unipile_message_id_key
  on public.messaging_messages (unipile_message_id);

drop index if exists public.messaging_messages_unipile_message_uidx;
