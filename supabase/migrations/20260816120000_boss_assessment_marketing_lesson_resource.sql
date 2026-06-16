-- Link The BOSS Scorecard Marketing doc to the Client Acquisition lesson.

insert into public.academy_resource_sections (id, area, parent_id, title, sort_order)
values ('profit-system', 'profit-system', null, 'PROFIT SYSTEM', 2)
on conflict (id) do nothing;

insert into public.academy_resource_sections (id, area, parent_id, title, sort_order)
values ('profit-system/revenue-and-marketing', 'profit-system', 'profit-system', 'REVENUE AND MARKETING', 2)
on conflict (id) do nothing;

insert into public.academy_resources (section_id, topic, title, url, resource_kind, sort_order)
values (
  'profit-system/revenue-and-marketing',
  'BOSS Assessment Marketing',
  'The BOSS Scorecard Marketing',
  'https://docs.google.com/document/d/1rDJk4xHGb3InGBgZER1d_PEWKfbLF1c2ZFIvQXK2QZQ/edit?usp=sharing',
  'document',
  0
)
on conflict (section_id, url, title) do nothing;

insert into public.academy_lesson_resources (course_id, lesson_id, resource_id, sort_order)
select
  'client-acquisition',
  'client-acquisition-boss-assessment-marketing-how-to-use-the-boss-score-assessment',
  r.id,
  0
from public.academy_resources r
where r.url = 'https://docs.google.com/document/d/1rDJk4xHGb3InGBgZER1d_PEWKfbLF1c2ZFIvQXK2QZQ/edit?usp=sharing'
on conflict (course_id, lesson_id, resource_id) do nothing;
