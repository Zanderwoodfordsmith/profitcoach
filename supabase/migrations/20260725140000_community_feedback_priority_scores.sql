-- Admin priority scoring for community feedback triage.

alter table public.community_feedback_reports
  add column if not exists importance smallint check (importance between 1 and 5),
  add column if not exists ease smallint check (ease between 1 and 5);

create index if not exists community_feedback_reports_priority_idx
  on public.community_feedback_reports (
    (coalesce(importance, 0) + coalesce(ease, 0)) desc,
    created_at desc
  );
