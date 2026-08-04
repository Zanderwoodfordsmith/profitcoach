-- Community Tour: drop the "explore each category" action (removed on purpose).
-- Do not re-add visit-community-feed in later migrations.
update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"reply-and-tag-member","text":"Reply to another coach and tag them in your response","completion":"tracked","verifyRule":"community_reply_with_mention"},
    {"id":"add-map-location","text":"Add your location on the Community Map","completion":"tracked","verifyRule":"community_map_location_set"},
    {"id":"browse-map-or-members","text":"Browse the Map or Members tab for coaches to connect with"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'kickstart'
  and lesson_id = 'kickstart-welcome-community-tour';
