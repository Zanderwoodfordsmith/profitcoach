-- Coach Clients · Client Launchpad: recommended actions from lesson bodies/guides/transcripts.
-- Content stored under client-delivery programme course_id.

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"create-clients-drive-folder","text":"Create a Google Drive Clients parent folder and an Example Client template folder"},
    {"id":"setup-first-client-folder","text":"For your next client, create Business Name – Client Name with Coaching Sheets, Recordings, and Alignment File"},
    {"id":"share-folder-content-manager","text":"Share the client folder with them as Content manager"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-client-onboarding-how-to-setup-a-new-client';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"open-session-1-sop","text":"Open the Session 1 SOP and Coaching Sheet templates before your next first session"},
    {"id":"run-profit-fun-dashboard","text":"In Session 1, complete the Profit-Fun Matrix / Dashboard with the client"},
    {"id":"agree-pre-next-session-actions","text":"Agree what they (or their team) will complete before Session 2, and note it where you will check first next time"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-client-onboarding-session-1-profit-systems-dashboard';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"pick-one-critical-issue","text":"In Session 2, pick one critical issue or opportunity from Session 1 and stay on it"},
    {"id":"leave-with-tangible-actions","text":"End with tangible actions they can start the same day — they should be itching to go do them"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-client-onboarding-session-2-leverage-critical-issues';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"complete-one-orbit-segment","text":"In Session 3, complete at least one 3-year orbit segment in detail (plus 2-year and 1-year goals)"},
    {"id":"identify-3-4-kpis","text":"Identify 3–4 KPIs to track, agree frequency, and start tracking"},
    {"id":"assign-remaining-segments-homework","text":"Set homework to complete the remaining orbit segments before the 90-day plan session"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-client-onboarding-session-3-align-3-year-plan';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"start-with-personal-goals","text":"Practise Pam''s Session 3 flow: start from personal 3–5 year lifestyle goals, then connect business goals"},
    {"id":"detail-one-segment-live","text":"Detail one orbit segment live with 3-year, 2-year and 1-year goals before assigning the rest as homework"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-other-coachin-session-content-session-3-align-the-3-year-plan';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"build-90-day-plan","text":"Turn the 3-year alignment into a focused 90-day plan with clear projects/rocks"},
    {"id":"check-plan-between-sessions","text":"Between sessions, check progress on the 90-day plan (message or open the next session with it)"},
    {"id":"use-plan-to-challenge-drift","text":"When they drift, use the agreed long-term goal and 90-day plan to challenge whether the new activity actually gets them there"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-client-onboarding-session-4-ninety-day-plan';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"use-coaching-sheet-every-session","text":"Use the coaching sheet every session and keep dated copies in the client folder"},
    {"id":"ask-key-learning-10-min-out","text":"About 10 minutes before the end, ask for the key learning / value from today"},
    {"id":"get-sheet-day-before","text":"Ask the client to complete and send the sheet the day before the next session"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coachiing-session-structure-how-to-use-the-coaching-sheet-in-sessions';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"treat-curriculum-as-framework","text":"Treat the session curriculum as a flexible framework — finish what you start before piling on new work"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coaching-session-faqs-coaching-faq-should-i-stick-to-the-coaching-sessions-exactly-in-the-orde';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"revisit-plan-in-real-crisis","text":"In a real business crisis, pause and revise the 90-day plan rather than forcing the old rocks"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-clients-in-crisis';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"help-urgent-then-check-plan","text":"If a new priority is bothering them, help with it — then explicitly check whether it still fits the 90-day plan or needs a recalibrate"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-a-client-with-a-new-priority-that-is-off-plan';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"bring-agenda-and-priorities","text":"Bring your own session agenda, but clear whatever is on their mind first, then review last session''s priorities"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coaching-session-faqs-coaching-faq-how-do-you-run-a-typical-coaching-session-james-baker';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"coach-to-their-life-priority","text":"Coach to their real priority (e.g. time with family), not your assumption that they must grow revenue first"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-clients-who-don-t-want-to-grow-the-business';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"name-sense-without-accusing","text":"When answers feel off, name your sense gently (\"I''m sensing…\") and ask what else is showing up — do not accuse"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-clients-giving-false-or-uncertain-answers';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"agree-three-actions-end","text":"End by agreeing the three actions they will work on, and open the next session by checking those three"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coaching-session-faqs-coaching-faq-how-do-you-end-a-coaching-session-ashley-maile';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"break-down-or-do-together","text":"If a tool like cashflow keeps stalling, break it into smaller weekly chunks — or do one pass together in-session to unblock them"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coaching-session-faqs-coaching-faq-how-do-you-handle-clients-who-don-t-do-cashflow-or-other-to';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"use-drains-and-boosts","text":"If energy/commitment is low repeatedly, run drains and boosts and help them reduce what keeps draining them"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-a-client-with-low-energy-and-commitment';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"use-goal-open","text":"Open with G.O.A.L: Greet & Gauge, Outline objectives, Agree agenda, Latest learning"},
    {"id":"use-rpms-review","text":"Then run R.P.M.S: review key-issue progress, performance, metrics, successes and challenges"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coachiing-session-structure-how-to-start-a-coaching-session';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"use-finish-framework","text":"Close with F.I.N.I.S.H: feedback, insights, next steps, inspire, schedule, help/support"},
    {"id":"confirm-actions-and-next-date","text":"Confirm specific between-session actions and book the next session before you hang up"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-delivery'
  and lesson_id = 'client-delivery-coachiing-session-structure-how-eo-end-a-coaching-session';
