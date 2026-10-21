-- Roadmap: an Urgent flag for jobs where waiting costs money or risk. Flagged
-- jobs jump the queue whatever their impact + ease total.

alter table public.roadmap_jobs
  add column if not exists urgent boolean not null default false;
