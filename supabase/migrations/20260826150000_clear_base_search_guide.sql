-- Base search is one click now; retire the long manual guide.
update public.academy_lesson_content
set
  guide_markdown = null,
  updated_at = now()
where lesson_id = 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-base-search';
