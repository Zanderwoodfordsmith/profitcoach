-- Projects are work with an end (28 Oct): Now, Next, then Done. Ideas without
-- an end live in the backlog by area, not as projects. Later and Parked stay
-- allowed so nothing old breaks; the app no longer offers them.

alter table public.roadmap_projects drop constraint if exists roadmap_projects_stage_check;
alter table public.roadmap_projects
  add constraint roadmap_projects_stage_check check (stage in ('now', 'next', 'done', 'later', 'parked'));
