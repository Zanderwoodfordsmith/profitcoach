-- Consolidate LinkedIn profile setup into one workflow lesson with guide steps.
insert into public.academy_lesson_content (
  course_id,
  lesson_id,
  title,
  duration,
  body_markdown,
  recommended_actions,
  video_chapters,
  updated_at
)
values (
  'get-calls',
  'get-calls-linkedin-optimization-set-up-your-linkedin-profile',
  'Set Up Your LinkedIn Profile',
  '',
  E'### What is this?\n\nOptimise your LinkedIn profile so prospects see a credible coach when they click through from outreach.\n\n### How to use this lesson\n\nWork through each step in the **Guide** tab in order. The announcement post at the end is optional, but most coaches benefit from doing it.',
  '[
    {"id":"open-profile-checklist","text":"Open the LinkedIn Profile Optimisation Checklist and work through the first-impression items"},
    {"id":"personalise-linkedin-url","text":"Personalise your LinkedIn public profile URL"},
    {"id":"update-headline-value","text":"Update your headline so it is specific to your audience and the value you add"},
    {"id":"link-company-page","text":"Link your profile to a company page (your business or Profit Coach)"},
    {"id":"upload-professional-headshot","text":"Get and upload a professional headshot (head and shoulders, smiling, taken within the last 3 years)"},
    {"id":"set-simple-industry-banner","text":"Set a simple LinkedIn banner: industry-related image, no text or fancy headlines"},
    {"id":"submit-about-form","text":"Submit the About-section form (privacy, core client, core skills, key milestones)"},
    {"id":"paste-returned-about","text":"When the draft comes back, paste it into your LinkedIn About section"},
    {"id":"optional-announcement-post","text":"Optional: customise the Profit Coach announcement template and post it on LinkedIn (skip if keeping coaching low-profile)"}
  ]'::jsonb,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'checklist',
      'title', 'LinkedIn Profile: Checklist To Optimise Your Profile',
      'source_lesson_id', 'get-calls-linkedin-optimization-linkedin-profile-checklist-to-optimise-your-profile'
    ),
    jsonb_build_object(
      'id', 'headshot',
      'title', 'Setup A Professional Headshot',
      'source_lesson_id', 'get-calls-linkedin-optimization-linkedin-profile-setup-a-professional-headshot'
    ),
    jsonb_build_object(
      'id', 'banner',
      'title', 'Designing Your Banner',
      'source_lesson_id', 'get-calls-linkedin-optimization-linkedin-profile-designing-your-banner'
    ),
    jsonb_build_object(
      'id', 'about-section',
      'title', 'DFY Write Your About Section',
      'source_lesson_id', 'get-calls-linkedin-optimization-linkedin-profile-dfy-write-your-about-section'
    ),
    jsonb_build_object(
      'id', 'announcement-post',
      'title', 'Profit Coach LinkedIn Announcement Post',
      'source_lesson_id', 'get-calls-linkedin-optimization-profit-coach-linkedin-announcement-post',
      'duration', '2m',
      'optional', true
    )
  ),
  now()
)
on conflict (course_id, lesson_id) do update set
  title = excluded.title,
  duration = excluded.duration,
  body_markdown = excluded.body_markdown,
  recommended_actions = excluded.recommended_actions,
  video_chapters = excluded.video_chapters,
  updated_at = excluded.updated_at;
