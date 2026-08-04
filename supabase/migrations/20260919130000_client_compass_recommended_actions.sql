-- Get Calls · Client Compass: recommended actions from lesson guides/transcripts.

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"write-core-client","text":"Write your core client in one line: industry + decision-maker role, based on your strongest career proof"},
    {"id":"score-five-criteria","text":"Score that choice against the 5 criteria: most value, pain, growing, easy to find, purchasing power"},
    {"id":"commit-niche-window","text":"Commit to this core client for at least 3–6 months before changing niche"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-how-to-choose-your-core-client';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"map-want-available-skills","text":"Write the overlap: what you want, what is actually available in the market, and which search skills you still need"},
    {"id":"commit-follow-system","text":"Commit to following the prospect-search system in the next lessons instead of inventing your own method"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-proactive-prospecting-your-path-to-finding-ideal-clients';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"write-current-day","text":"Write your core client''s current day from morning to evening in their world"},
    {"id":"write-ideal-day","text":"Write their ideal day from morning to evening"},
    {"id":"list-frustrations-and-goals","text":"List the frustrations and goals that sit in the gap between those two days"},
    {"id":"note-messaging-angles","text":"Note 3 messaging angles that wrap what they need in what they already want"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-give-them-what-they-want-understanding-your-client-s-day';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"mentor-rant-answer","text":"Answer \"How can I help?\" in your prospect''s exact words (rant allowed — their language, not yours)"},
    {"id":"mentor-specific-fix","text":"Answer \"What specifically do you need help with?\" in their words"},
    {"id":"save-messaging-source-language","text":"Save both answers as source language for your outreach and offer messaging"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-ideal-clients-the-mentor-exercise';
