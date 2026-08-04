-- Get Calls · Pipeline Setup: recommended actions from lesson guides/transcripts.
-- Skips calendar lesson (no academy_lesson_content row yet).

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"write-find-for-core-client","text":"Write your FIND plan for your core client: Features, Interaction/Intent, Narrowing filters, and how you will check Data quality"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-principles-of-effective-prospect-search-find';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"note-list-size-target","text":"Note your prospect-list size target for testing (aim toward lists large enough for 600+ contacts when possible)"},
    {"id":"spot-check-eight-of-ten","text":"Spot-check 10 random profiles from a list and only proceed if at least 8 of 10 are a good match"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-evaluating-prospect-list-kpis';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"get-sales-nav-access","text":"Get LinkedIn Sales Navigator Core access (free trial if available, otherwise paid)"},
    {"id":"open-lead-filters","text":"Open Sales Navigator and confirm you can reach Lead Filters"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-linkedin-sales-navigator-sign-up';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"build-base-criteria","text":"Build your base search: 2nd + 3rd connections, your location, headcount 1–200, and owner/CEO-style titles"},
    {"id":"exclude-coaches-competitors","text":"Exclude coach titles and competitor companies from the base search"},
    {"id":"save-base-search","text":"Save the base search so you can reuse it"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-linkedin-sales-navigator-build-your-base-search';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"add-industry-filters","text":"Start from your base search and add industry / company filters for your core client"},
    {"id":"save-ideal-prospect-list","text":"Save your ideal prospect list (or lead list) once it looks right"},
    {"id":"tell-coach-list-ready","text":"Tell your coach or post in the Ideal Client thread that your list is ready (or ask for help if stuck)"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-linkedin-sales-navigator-build-your-ideal-prospect-list';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"blacklist-bad-titles-companies","text":"Blacklist / exclude titles and companies that do not match your core client"},
    {"id":"recheck-list-quality","text":"Re-check list quality after refining (still aiming for 8/10 good matches)"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-linkedin-sales-navigator-refining-your-ideal-prospect-list-blacklisting';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"try-keyword-expansion","text":"If your list is too small, expand with keyword searches (and remove conflicting company-industry includes)"},
    {"id":"save-keyword-lead-lists","text":"Save useful keyword results into lead lists you can combine later"},
    {"id":"ask-community-keywords","text":"If stuck, post your keywords/screenshots in the community and ask for feedback"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-linkedin-sales-navigator-find-more-prospects-with-keyword-search';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"optional-extra-sources","text":"Optional: only if Sales Navigator is not enough — note one industry-specific lead source or join 1–2 relevant LinkedIn groups"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-finding-ideal-clients-beyond-traditional-methods';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"open-profile-checklist","text":"Open the LinkedIn Profile Optimisation Checklist and work through the first-impression items"},
    {"id":"personalise-linkedin-url","text":"Personalise your LinkedIn public profile URL"},
    {"id":"update-headline-value","text":"Update your headline so it is specific to your audience and the value you add"},
    {"id":"link-company-page","text":"Link your profile to a company page (your business or Profit Coach)"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-linkedin-optimization-linkedin-profile-checklist-to-optimise-your-profile';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"upload-professional-headshot","text":"Get and upload a professional headshot (head and shoulders, smiling, taken within the last 3 years)"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-linkedin-optimization-linkedin-profile-setup-a-professional-headshot';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"set-simple-industry-banner","text":"Set a simple LinkedIn banner: industry-related image, no text or fancy headlines"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-linkedin-optimization-linkedin-profile-designing-your-banner';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"submit-about-form","text":"Submit the About-section form (privacy, core client, core skills, key milestones)"},
    {"id":"paste-returned-about","text":"When the draft comes back, paste it into your LinkedIn About section"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-linkedin-optimization-linkedin-profile-dfy-write-your-about-section';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"optional-announcement-post","text":"Optional: customise the Profit Coach announcement template and post it on LinkedIn (skip if keeping coaching low-profile)"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-linkedin-optimization-profit-coach-linkedin-announcement-post';
