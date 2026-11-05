-- When staff last set a ticket back to Open by hand. If that is newer than the
-- latest message, the inbox keeps the ticket in "needs reply" instead of
-- inferring "Waiting on member" from our reply being the last word.
alter table public.community_feedback_reports
  add column if not exists reopened_at timestamptz;
