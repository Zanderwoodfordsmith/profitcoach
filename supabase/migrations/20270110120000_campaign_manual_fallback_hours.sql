-- Default for new manual LinkedIn messages: null = stay in the coach queue.
-- Existing steps keep their own fallback_hours; this is copied onto new ones only.

alter table public.linkedin_campaigns
  add column if not exists manual_fallback_hours numeric(10, 2);
