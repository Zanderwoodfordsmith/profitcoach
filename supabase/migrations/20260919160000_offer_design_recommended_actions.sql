-- Win Clients · Offer Design: recommended actions from lesson guides/transcripts.
-- Content is stored under coach-action-plan programme course_id.

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"write-client-gap","text":"Write your core client''s Gap: current state vs ideal state in their language"},
    {"id":"pick-priority-pillars","text":"Circle the 1–2 PROFIT pillars they care about most right now (for messaging and sales)"},
    {"id":"sell-the-shift-not-coaching","text":"Rewrite one outreach or reply line so it sells the shift/outcome, not coaching itself"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'coach-action-plan'
  and lesson_id = 'coach-action-plan-building-a-world-class-coaching-practice-57m-what-are-people-actually-buying-the-gap';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"define-outcome-offer","text":"Define your coaching offer as outcomes and packages — not hourly rates"},
    {"id":"choose-session-rhythm","text":"Choose your default rhythm: weekly for the first 4–6 weeks, then 2 × 90-minute sessions per month (or your equivalent)"},
    {"id":"plan-client-stacking-days","text":"Pick the days you will stack client sessions so marketing and lifestyle stay protected"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'coach-action-plan'
  and lesson_id = 'coach-action-plan-building-a-world-class-coaching-practice-57m-structuring-your-coaching-offer-what-are-you-actually-selling';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"choose-pricing-model","text":"Choose your starting pricing model: monthly retainer or 6-month package (with payment-plan options)"},
    {"id":"set-starting-price","text":"Set your starting price (if unsure: about £1,450/mo or £7,800–£9,600 for 6 months)"},
    {"id":"write-value-justification","text":"Write the value justification you will use: transformation, experience, and tools/methods"},
    {"id":"plan-price-staircase","text":"Plan your price staircase (e.g. raise by ~£500 every 2–4 new clients)"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'coach-action-plan'
  and lesson_id = 'coach-action-plan-building-a-world-class-coaching-practice-57m-pricing-setting-the-right-packages-investment-for-your-coaching';
