-- A free write-up on each project's and initiative's own page (markdown). Additive only.
alter table public.roadmap_projects add column if not exists brief text;
alter table public.roadmap_initiatives add column if not exists brief text;
