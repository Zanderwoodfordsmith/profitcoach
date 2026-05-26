-- BOSS Pro methodology version tracking (v2 restructure)
alter table public.assessments
  add column if not exists methodology_version integer not null default 2;

comment on column public.assessments.methodology_version is
  'BOSS diagnostic question set version (1 = legacy, 2 = outcome-based restructure)';

-- Existing diagnostic rows completed before v2 ship as version 1
update public.assessments
set methodology_version = 1
where assessment_type = 'diagnostic_50'
  and methodology_version = 2;
