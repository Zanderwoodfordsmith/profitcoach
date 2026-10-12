-- Furthest Boss Scorecard screen a prospect reached before they submit.
alter table public.contacts
  add column if not exists scorecard_last_screen int,
  add column if not exists scorecard_progress_at timestamptz;

comment on column public.contacts.scorecard_last_screen is
  'Last Boss Scorecard screen (1–16) reported before the assessment is submitted.';
comment on column public.contacts.scorecard_progress_at is
  'When scorecard_last_screen was last moved forward.';
