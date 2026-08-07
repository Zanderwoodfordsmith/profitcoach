-- Get Calls · Lead Engine: recommended actions from lesson guides/transcripts.

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"commit-cold-dm-linkedin","text":"Commit to the default traffic mix for now: cold LinkedIn DMs first, plus a little warm outreach and content to support it"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-lead-generation-intro-traffic-the-best-wat-to-get-leads';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"review-lead-gen-six","text":"Review the Lead Generation Six and note which campaigns you will run in order (Connector → Permission Pitch → VIP Nurture, then the rest as needed)"},
    {"id":"save-workflow-diagram","text":"Save or print the lead-generation workflow diagram so you can follow the stages and expected numbers"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-lead-generation-intro-lead-generation-workflow';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"write-test-hypothesis","text":"Write one outreach test hypothesis (e.g. which hook or pain point should win)"},
    {"id":"create-two-variations","text":"Create two message variations and decide the metrics you will track (accepts, replies, booked calls)"},
    {"id":"document-test-results","text":"After a test, record what won and what you will keep for the next round"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-lead-generation-intro-testing-is-key-to-lead-generation';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"plan-vip-nurture-system","text":"Sketch your VIP Nurture plan: Top 100 list, personalised value messages, multi-channel touchpoints, and how you will track replies"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-lead-generation-personalised-vip-nurture-top-100-vip-nurture-overview';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"select-top-100","text":"Select your Top 100: best-fit prospects plus warm relationships worth nurturing"},
    {"id":"ensure-contactable","text":"Make sure each person is contactable (LinkedIn connection plus email or phone where possible)"},
    {"id":"store-top-100-list","text":"Store the Top 100 in one system (Sales Nav saved leads, Connector tags/campaign, CRM, or a simple spreadsheet)"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-lead-generation-personalised-vip-nurture-top-100-how-to-identify-your-top-100-prospects';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"open-insight-templates","text":"Open the VIP Nurture / personalised-message templates"},
    {"id":"draft-insight-messages","text":"Draft 3 personalised messages using INSIGHT (specific research, need, insight, proof, help, clear CTA)"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-lead-generation-personalised-vip-nurture-top-100-how-to-craft-personalized-insightful-messages';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"engage-linkedin-weekly","text":"Engage weekly on LinkedIn with Top 100 prospects (like/comment plus personalised DMs)"},
    {"id":"add-email-or-call-touch","text":"Add at least one email or phone touch for your highest-priority prospects"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-lead-generation-personalised-vip-nurture-top-100-how-to-use-multiple-channels-to-engage';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"use-reply-templates-first","text":"When a prospect replies, use the reply templates first instead of freestyling"},
    {"id":"no-sell-in-first-replies","text":"Do not sell or push a meeting in the first replies — lead with questions, empathy and clarity"},
    {"id":"keep-conversation-alive","text":"If a reply is neutral, ask one clear follow-up question instead of giving up"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-replying-to-leads-mistakse-to-avoid-when-replying-to-prospects';
