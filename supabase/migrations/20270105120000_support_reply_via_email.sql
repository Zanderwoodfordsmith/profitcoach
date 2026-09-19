-- Mark support replies that arrived by email or were emailed to the member.

alter table public.community_feedback_replies
  add column if not exists via_email boolean not null default false;

comment on column public.community_feedback_replies.via_email is
  'True when this message arrived via email, or was included in an email to the member.';

update public.community_feedback_replies
set via_email = true
where bird_message_id is not null
  and via_email = false;
