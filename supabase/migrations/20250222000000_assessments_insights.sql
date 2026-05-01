-- Store Claude-generated insight text per assessment

alter table assessments
  add column if not exists insights jsonb,
  add column if not exists insights_generated_at timestamptz;

comment on column assessments.insights is 'Generated insight surfaces (overallShort, overallLong, levels, pillars, areas, etc.) from Claude API';
comment on column assessments.insights_generated_at is 'When insights were last generated';
