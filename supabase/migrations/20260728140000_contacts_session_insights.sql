-- AI coaching insights generated from coach workshop session scores.
alter table public.contacts
  add column if not exists session_insights jsonb,
  add column if not exists session_insights_generated_at timestamptz;

comment on column public.contacts.session_insights is
  'AI-generated coaching insights keyed by level/pillar/area for workshop session scores.';

comment on column public.contacts.session_insights_generated_at is
  'When session_insights were last generated from session_answers.';
