-- Merge Get Started With Connector + Launch Your Connector Campaign
-- into one chaptered lesson: Set Up & Launch Connector.

update public.academy_lesson_content
set
  title = 'Set Up & Launch Connector',
  duration = '18m',
  body_markdown = E'### What is this?\n\nRegister for Connector, prepare your messages, then create and launch your campaigns — including open InMail when needed.\n\n### How to use this lesson\n\nWork through each step in the **Guide** tab in order.',
  video_chapters = jsonb_build_array(
    jsonb_build_object(
      'id', 'register',
      'title', 'What is Connector & How To Register for Connector Ai',
      'source_lesson_id', 'get-calls-lead-generation-ai-automation-what-is-connector-how-to-register-for-connector-ai',
      'duration', '3m'
    ),
    jsonb_build_object(
      'id', 'overview',
      'title', 'Connector Campaign: Overview',
      'source_lesson_id', 'get-calls-lead-generation-ai-automation-connector-campaign-overview'
    ),
    jsonb_build_object(
      'id', 'connection-message',
      'title', 'Write A LinkedIn Connection Message',
      'source_lesson_id', 'get-calls-lead-generation-ai-automation-write-a-linkedin-connection-message'
    ),
    jsonb_build_object(
      'id', 'follow-up-templates',
      'title', 'Connector Campaign: Editing Follow-up Message Templates',
      'source_lesson_id', 'get-calls-lead-generation-ai-automation-connector-campaign-editing-follow-up-message-templates'
    ),
    jsonb_build_object(
      'id', 'create-campaign',
      'title', 'How to Create Campaigns in Connect Ai',
      'source_lesson_id', 'get-calls-lead-generation-ai-automation-how-to-create-campaigns-in-connect-ai',
      'duration', '7m'
    ),
    jsonb_build_object(
      'id', 'connected-campaign',
      'title', 'How to Create a Campaign for Prospects you are Already Connected With',
      'source_lesson_id', 'get-calls-lead-generation-ai-automation-how-to-create-a-campaign-for-prospects-you-are-already-connected-with',
      'duration', '2m'
    ),
    jsonb_build_object(
      'id', 'open-inmail',
      'title', 'Targeted Open InMail: Craft Open InMail Message',
      'source_lesson_id', 'get-calls-lead-generation-ai-automation-targeted-open-inmail-craft-open-inmail-message',
      'duration', '6m'
    )
  ),
  is_deleted = false,
  updated_at = now()
where course_id = 'get-calls'
  and lesson_id = 'get-calls-lead-generation-get-started-with-connector';

-- Soft-delete the old Launch parent; URLs redirect via classroomIdAliases.
update public.academy_lesson_content
set
  is_deleted = true,
  updated_at = now()
where course_id = 'get-calls'
  and lesson_id = 'get-calls-lead-generation-launch-your-connector-campaign';
