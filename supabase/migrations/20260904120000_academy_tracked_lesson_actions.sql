-- Tracked academy lesson actions: completion is system-verified, not self-ticked.
-- Shape: recommended_actions[] = { id, text, completion?, verifyRule? }
--   completion: "manual" (default) | "tracked"
--   verifyRule: community_intro_posted | community_reply_with_mention | …

comment on column public.academy_lesson_content.recommended_actions is
  'JSON array of { id, text, completion?, verifyRule? }. completion=tracked means the system verifies done via verifyRule; coaches cannot self-tick those.';

-- Introduce Yourself: only completes when they post in Intros
update public.academy_lesson_content
set
  recommended_actions = '[
    {
      "id": "post-introduction",
      "text": "Post your introduction in the community",
      "completion": "tracked",
      "verifyRule": "community_intro_posted"
    }
  ]'::jsonb,
  updated_at = now()
where course_id = 'kickstart'
  and lesson_id = 'kickstart-welcome-introduce-yourself';

-- Community Tour: reply+tag is tracked
update public.academy_lesson_content
set
  recommended_actions = '[
    {
      "id": "reply-and-tag-member",
      "text": "Reply to another coach and tag them in your response",
      "completion": "tracked",
      "verifyRule": "community_reply_with_mention"
    }
  ]'::jsonb,
  updated_at = now()
where course_id = 'kickstart'
  and lesson_id = 'kickstart-welcome-community-tour';
