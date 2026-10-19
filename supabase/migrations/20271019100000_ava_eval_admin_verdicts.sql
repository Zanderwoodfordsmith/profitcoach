-- Admin verdicts on the judge: "right", "too harsh" or "too soft" on any scored
-- piece, so BCA's own calls become labels and we can measure how far to trust
-- the judge. Additive only.
alter table public.ava_eval_results
  add column if not exists admin_verdict text check (admin_verdict in ('agree', 'too_harsh', 'too_soft')),
  add column if not exists admin_note text,
  add column if not exists admin_labelled_at timestamptz;

alter table public.coach_quality_scores
  add column if not exists admin_verdict text check (admin_verdict in ('agree', 'too_harsh', 'too_soft')),
  add column if not exists admin_note text,
  add column if not exists admin_labelled_at timestamptz;
