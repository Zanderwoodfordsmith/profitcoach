-- Roadmap: four product categories along the coach journey, and impact / ease
-- scores (1-5) for the impact vs ease graph.
--   set-up        practice install: Blueprint, brand, website, profile, onboarding
--   get-clients   leads, replies, bookings, closes
--   keep-clients  deliver for clients and keep them
--   platform      the app itself: Classroom, Ava plumbing, admin, fixes
-- Replaces website / ai-panel / q4 / general.

alter table public.roadmap_jobs
  add column if not exists impact smallint
    check (impact between 1 and 5),
  add column if not exists ease smallint
    check (ease between 1 and 5);

update public.roadmap_jobs set area = 'set-up', updated_at = now()
where area = 'website';

update public.roadmap_jobs set area = 'get-clients', updated_at = now()
where area = 'q4';

update public.roadmap_jobs set area = 'platform', updated_at = now()
where area = 'ai-panel';

-- General jobs that belong to a coach outcome (by job number, BLD-0002 etc).
update public.roadmap_jobs set area = 'set-up', updated_at = now()
where area = 'general' and job_number in (2, 9, 12, 24);

update public.roadmap_jobs set area = 'get-clients', updated_at = now()
where area = 'general' and job_number in (5, 7);

update public.roadmap_jobs set area = 'platform', updated_at = now()
where area = 'general';

alter table public.roadmap_jobs alter column area set default 'platform';
