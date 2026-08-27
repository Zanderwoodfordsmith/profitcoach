-- Shorter coach certification lesson titles (drop "Certification" and week numbers).

update public.academy_lesson_content
set title = 'Welcome', updated_at = now()
where course_id = 'coach-clients'
  and lesson_id = 'coach-clients-certification-welcome-to-profit-coach-certification';

update public.academy_lesson_content
set title = 'COACH Foundations', updated_at = now()
where course_id = 'coach-clients'
  and lesson_id = 'coach-clients-certification-week-1-coach-foundations';

update public.academy_lesson_content
set title = 'Powerful Questions', updated_at = now()
where course_id = 'coach-clients'
  and lesson_id = 'coach-clients-certification-week-2-powerful-questions';

update public.academy_lesson_content
set title = 'Lasting Transformation', updated_at = now()
where course_id = 'coach-clients'
  and lesson_id = 'coach-clients-certification-week-3-lasting-transformation';

update public.academy_lesson_content
set title = 'World-Class Coach', updated_at = now()
where course_id = 'coach-clients'
  and lesson_id = 'coach-clients-certification-week-4-world-class-coach';
