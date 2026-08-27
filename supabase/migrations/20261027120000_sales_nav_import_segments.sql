-- Segmented Sales Nav imports (team-size / tenure sub-searches).

alter table public.sales_nav_import_runs
  add column if not exists segmented boolean not null default false,
  add column if not exists segment_index integer not null default 0,
  add column if not exists segment_total integer not null default 1,
  add column if not exists segment_plan jsonb;

comment on column public.sales_nav_import_runs.segmented is
  'When true, this job runs multiple Sales Nav URL segments sequentially (team size / tenure splits).';

comment on column public.sales_nav_import_runs.segment_plan is
  'Ordered segment definitions + per-segment status for segmented imports.';

notify pgrst, 'reload schema';
