-- Reply came in or went out on WhatsApp (e.g. added by hand from a phone).
-- The admin thread shows a WhatsApp mark where the email mark goes.
alter table public.community_feedback_replies
  add column if not exists via_whatsapp boolean not null default false;
