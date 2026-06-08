-- Tracks which assessment funnel a prospect last entered (boss scorecard vs boss pro).

alter table public.contacts
  add column if not exists prospect_funnel text;

comment on column public.contacts.prospect_funnel is
  'Last assessment funnel the prospect entered: boss_scorecard or diagnostic_50.';
