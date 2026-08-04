-- Going Pro (Day Zero): curated recommended actions from lesson transcripts/guides.
-- All manual ticks for now — no product verify rules wired for these behaviours yet.

-- Foreword: phone away is the only explicit action in the video.
update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"phone-dnd-other-room","text":"Put your phone in another room on Do Not Disturb while working and while watching these videos"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'going-pro'
  and lesson_id = 'going-pro-iii-1-day-zero-foreword-to-day-zero-going-pro';

-- PRO Energy
update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"plan-evening-sleep-routine","text":"Plan your evening sleep routine (fixed bedtime, dark/cool room, no screens 90 minutes before bed)"},
    {"id":"plan-eating-routine","text":"Write your eating rules for the next 7 days (feeding window if using intermittent fasting, what you will avoid)"},
    {"id":"plan-exercise-routine","text":"Schedule your exercise minimum (at least 20 minutes aerobic, 3 times per week, not within 2 hours of bed)"},
    {"id":"plan-emotions-routine","text":"Choose a daily emotions practice (name how you feel, optional 10-minute meditation)"},
    {"id":"energy-boosts-and-drains","text":"Write today''s energy boosts and drains, then decide one change to get more boosts or fewer drains"},
    {"id":"define-recovery-rituals","text":"Define 10–30 minute recovery rituals for physical, emotional, mental and purpose energy"},
    {"id":"set-daily-water-target","text":"Set your daily water target and pick the bottle or glass count you will finish"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'going-pro'
  and lesson_id = 'going-pro-iii-1-day-zero-pro-energy';

-- PRO Time-Management
update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"complete-time-scan","text":"Complete the Time Scan worksheet for a full week"},
    {"id":"complete-time-value","text":"Complete the Time Value worksheet and mark what to eliminate, automate or transfer"},
    {"id":"create-default-diary","text":"Create your Default Diary and put the repeating blocks in Google Calendar"},
    {"id":"setup-time-tracking","text":"Set up Harvest (or equivalent) and start tracking where your work time goes"},
    {"id":"calculate-hour-worth","text":"Calculate the hourly rate your income goal requires, then list tasks below that rate to offload"},
    {"id":"outsource-one-life-task","text":"Choose one personal task to outsource or simplify this week (meals, laundry, errands or cleaning)"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'going-pro'
  and lesson_id = 'going-pro-iii-1-day-zero-pro-time-management';

-- PRO Focus
update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"protect-deep-work-block","text":"Protect an uninterrupted deep-work block every workday (ideally your first hours after waking)"},
    {"id":"phone-away-during-focus","text":"Keep your phone in another room with notifications off during that deep-work block"},
    {"id":"setup-focus-tools","text":"Set up focus tools on your phone, browser and desktop so distraction is hard by default"},
    {"id":"clear-workspace-clutter","text":"Clear clutter from your desk and workspace"},
    {"id":"tell-household-focus-hours","text":"Tell the people around you your focus hours so they know when not to interrupt"},
    {"id":"decide-focus-pacts","text":"Decide which effort, price or identity pacts you will run (if any)"},
    {"id":"optional-focusmate-or-dopamine-day","text":"Optional: book a Focusmate session or set one dopamine-reset day each week"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'going-pro'
  and lesson_id = 'going-pro-iii-1-day-zero-pro-focus';

-- PRO Productivity
update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"write-goals-with-why","text":"Write your goals with the objective, why it matters, and the obstacles you expect"},
    {"id":"choose-productivity-system","text":"Choose a productivity system that covers notes, a project roadmap, and daily time-blocking"},
    {"id":"setup-productivity-tools","text":"Set up the tools you chose (or a simpler notes + checklist version) so planning takes a few clicks"},
    {"id":"plan-tomorrow-mit","text":"Every evening, pick tomorrow''s one most important thing and time-block it"},
    {"id":"define-weekly-evidence","text":"Define the physical evidence you will have completed by the end of this week"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'going-pro'
  and lesson_id = 'going-pro-iii-1-day-zero-pro-productivity';

-- PRO Mindset
update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"download-mind-altering-protocol","text":"Download the Mind Altering Protocol checklist"},
    {"id":"complete-one-page-growth-plan","text":"Complete the One Page Growth Plan (D.R.E.A.M.S.)"},
    {"id":"review-growth-plan-daily","text":"Review your One Page Growth Plan each morning and evening"},
    {"id":"schedule-mindset-rewatch","text":"Set a time to rewatch this lesson"},
    {"id":"use-checklist-when-stuck","text":"When motivation drops, walk the checklist: make it clear, why it matters, no doubt, then decide and do"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'going-pro'
  and lesson_id = 'going-pro-iii-1-day-zero-pro-mindset';

-- D.A.I.L.Y Success Framework (reference lesson; content lives under coach-action-plan programme id)
update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"open-daily-checklist","text":"Open the Daily Checklist and keep it somewhere you will see it each workday"},
    {"id":"work-top-down-daily","text":"Each workday, work top-down: Delivery → Acquisition → Interest follow-up → Lead generation → You"},
    {"id":"protect-you-block","text":"Protect a daily You block (sleep, movement, nutrition and programme skill time)"},
    {"id":"set-outbound-volume-target","text":"When you are in lead-gen mode, set a weekly outbound volume target and track it"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'coach-action-plan'
  and lesson_id = 'coach-action-plan-building-a-world-class-coaching-practice-57m-daily-checklist-of-a-world-class-coach';
