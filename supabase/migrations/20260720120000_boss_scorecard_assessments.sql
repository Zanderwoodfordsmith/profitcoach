-- BOSS Scorecard assessment type and qualifying fields
alter table assessments
  add column if not exists assessment_type text not null default 'diagnostic_50',
  add column if not exists qualifying_data jsonb,
  add column if not exists open_text text,
  add column if not exists boss_level text,
  add column if not exists last_screen_reached int;

comment on column assessments.assessment_type is 'diagnostic_50 | boss_scorecard';
comment on column assessments.qualifying_data is 'BOSS Scorecard screen 12 qualifying answers';
comment on column assessments.open_text is 'BOSS Scorecard screen 13 optional open text';
comment on column assessments.boss_level is 'BOSS Scorecard owner level band';
comment on column assessments.last_screen_reached is 'Last screen reached for abandonment tracking';
