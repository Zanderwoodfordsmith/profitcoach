-- Job detail workspace: checklist + comments as jsonb arrays on the job.
-- Shapes: checklist [{id, text, done}], comments [{id, text, author, created_at}].

alter table public.roadmap_jobs
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists comments jsonb not null default '[]'::jsonb;
