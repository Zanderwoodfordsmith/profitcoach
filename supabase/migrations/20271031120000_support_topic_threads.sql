-- Messages: ready-made topic threads per coach (Getting started, Blueprint,
-- LinkedIn profile, Lead list, Campaigns, Calls and clients, Billing,
-- Anything else). A topic thread is a support ticket with a topic key, made
-- when the first message is written. One per coach per topic.

alter table public.community_feedback_reports
  add column if not exists topic text;

create unique index if not exists community_feedback_reports_created_by_topic_uidx
  on public.community_feedback_reports (created_by, topic)
  where topic is not null;
