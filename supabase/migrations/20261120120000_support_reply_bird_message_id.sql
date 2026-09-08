-- Dedupe Bird-inbound email replies attached to support tickets.

alter table public.community_feedback_replies
  add column if not exists bird_message_id text;

create unique index if not exists community_feedback_replies_bird_message_id_uidx
  on public.community_feedback_replies (bird_message_id)
  where bird_message_id is not null;

comment on column public.community_feedback_replies.bird_message_id is
  'Bird inbound message id when this reply arrived via email Reply-To.';
