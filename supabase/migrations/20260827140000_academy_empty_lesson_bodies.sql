-- Backfill empty academy lesson bodies (ROI calculator + chaptered lesson intros).
-- Source: content/academy/reformatted/*.md (applied via scripts/apply-academy-lesson-bodies.ts)

-- Legacy course id alias for ROI calculator (same content as coach-clients row).
update public.academy_lesson_content AS target
set
  body_markdown = source.body_markdown,
  title = coalesce(nullif(trim(source.title), ''), target.title),
  updated_at = now()
from public.academy_lesson_content AS source
where source.course_id = 'coach-clients'
  and source.lesson_id = 'coach-clients-certification-welcome-to-the-profit-coach-certification-profit-coacbh-roi-calculator'
  and target.course_id = 'profit-coach-certification'
  and target.lesson_id = 'profit-coach-certification-welcome-to-the-profit-coach-certification-profit-coacbh-roi-calculator'
  and coalesce(length(target.body_markdown), 0) = 0;
