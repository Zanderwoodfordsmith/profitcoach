-- Email-inbox replies had no dedupe key: if the mailbox sync re-scanned an
-- already-ingested email (e.g. Gmail left it role=unknown after archiving),
-- appendReplyToTicket inserted the same reply again on every pass — one
-- ticket reached 4,000+ copies of a single message.
--
-- Store the Unipile email id on the reply and enforce uniqueness so
-- re-ingesting the same email is a no-op.

alter table public.community_feedback_replies
  add column if not exists unipile_email_id text;

create unique index if not exists community_feedback_replies_unipile_email_id_key
  on public.community_feedback_replies (unipile_email_id)
  where unipile_email_id is not null;
