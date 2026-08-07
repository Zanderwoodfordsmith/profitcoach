-- Match Start Here "Where to post" labels to community category emojis.
update public.academy_lesson_content
set
  body_markdown = replace(
    replace(
      replace(
        replace(
          replace(
            body_markdown,
            '**General Discussion**',
            '**💬 General Discussion**'
          ),
          '**Wins** —',
          '**🏆 Wins** —'
        ),
        '**Announcements**',
        '**🚨 Announcements**'
      ),
      '**Ask & Share** —',
      '**🗣️ Ask & Share** —'
    ),
    '**Intros** —',
    '**👋 Intros** —'
  ),
  updated_at = now()
where course_id = 'kickstart'
  and lesson_id = 'kickstart-welcome-community-tour'
  and body_markdown like '%### Where to post%'
  and body_markdown like '%**General Discussion**%';
