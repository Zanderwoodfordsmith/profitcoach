-- Unpublish Profit Coach OS lessons that only fall back to the dead Disco domain
-- (academy.businesscoachacademy.com) AND have no in-app content.
-- Connector / Get Calls lessons that already have body markdown stay published.

insert into public.academy_lesson_content (course_id, lesson_id, is_draft, updated_at)
values
  ('profit-coach-os', 'profit-coach-os-brand-directory-membership-set-up-update-directory-profile', true, now()),
  ('profit-coach-os', 'profit-coach-os-boss-suite-boss-boss-pro-overview', true, now()),
  ('get-calls', 'get-calls-boss-assessment-marketing-how-to-use-the-boss-score-assessment', true, now()),
  ('profit-coach-os', 'profit-coach-os-boss-suite-use-boss-pro-in-value-sessions', true, now()),
  ('profit-coach-os', 'profit-coach-os-boss-suite-templates-resources', true, now()),
  ('profit-coach-os', 'profit-coach-os-crm-setup-usage-crm-overview', true, now()),
  ('profit-coach-os', 'profit-coach-os-crm-setup-usage-set-up-pipeline-stages', true, now()),
  ('profit-coach-os', 'profit-coach-os-crm-setup-usage-track-prospects-clients-sessions', true, now()),
  ('profit-coach-os', 'profit-coach-os-crm-setup-usage-crm-automations', true, now()),
  ('get-calls', 'get-calls-lead-generation-ai-automation-how-to-export-a-sales-nav-list-to-csv', true, now()),
  ('get-calls', 'get-calls-lead-generation-ai-automation-how-to-remove-undesired-profiles-blocklist-people', true, now()),
  ('get-calls', 'get-calls-faq-how-to-add-more-prospects-to-a-connector-campaign', true, now()),
  ('get-calls', 'get-calls-faq-how-to-remove-connections-from-a-campaign', true, now())
on conflict (course_id, lesson_id) do update
set
  is_draft = true,
  updated_at = now();

-- Ensure Connector lessons that already have in-app content stay live.
insert into public.academy_lesson_content (course_id, lesson_id, is_draft, updated_at)
values
  ('get-calls', 'get-calls-lead-generation-ai-automation-what-is-connector-how-to-register-for-connector-ai', false, now()),
  ('get-calls', 'get-calls-lead-generation-ai-automation-connector-campaign-overview', false, now()),
  ('get-calls', 'get-calls-lead-generation-ai-automation-write-a-linkedin-connection-message', false, now()),
  ('get-calls', 'get-calls-lead-generation-ai-automation-connector-campaign-editing-follow-up-message-templates', false, now()),
  ('get-calls', 'get-calls-lead-generation-ai-automation-how-to-create-campaigns-in-connect-ai', false, now()),
  ('get-calls', 'get-calls-lead-generation-ai-automation-targeted-open-inmail-craft-open-inmail-message', false, now()),
  ('get-calls', 'get-calls-lead-generation-ai-automation-how-to-create-a-campaign-for-prospects-you-are-already-connected-with', false, now()),
  ('get-calls', 'get-calls-replying-to-leads-how-to-set-up-connector-ai-co-pilot', false, now()),
  ('get-calls', 'get-calls-replying-to-leads-choosing-between-ai-co-pilot-auto-pilot', false, now()),
  ('get-calls', 'get-calls-replying-to-leads-how-to-activate-the-ai-and-test', false, now())
on conflict (course_id, lesson_id) do update
set
  is_draft = false,
  updated_at = now();
