-- Fix malformed chat-dash iframe embeds in Profit Coach Certification → Client Simulators.
-- Removes invalid HTML attributes/comments, uses a fixed 700px height, and restores the
-- correct Thai restaurant simulator id (was accidentally copied from Coach Practice 1).

UPDATE public.academy_lesson_content
SET
  body_markdown = regexp_replace(
    body_markdown,
    '<iframe[^>]*src="https://businesscoachacademy\.chat-dash\.com/iframe/([a-f0-9]+)"[^>]*>\s*</iframe>',
    '<iframe src="https://businesscoachacademy.chat-dash.com/iframe/\1" style="width: 100%; height: 700px; border: 0;" frameborder="0" allow="microphone"></iframe>',
    'gis'
  ),
  updated_at = now()
WHERE course_id = 'profit-coach-certification'
  AND lesson_id LIKE 'profit-coach-certification-client-simulators%'
  AND body_markdown ~* 'businesscoachacademy\.chat-dash\.com/iframe/';

UPDATE public.academy_lesson_content
SET
  body_markdown = replace(
    body_markdown,
    'https://businesscoachacademy.chat-dash.com/iframe/684eed1ae079e7d89f759156',
    'https://businesscoachacademy.chat-dash.com/iframe/68666afe41bd9b7cdbfc0176'
  ),
  updated_at = now()
WHERE course_id = 'profit-coach-certification'
  AND lesson_id = 'profit-coach-certification-client-simulators-revenue-optmisation-thai-restaurant';
