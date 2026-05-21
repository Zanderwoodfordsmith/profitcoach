-- Shareable BOSS scorecard report links (token in URL, no login).

alter table public.assessments
  add column if not exists report_token uuid default gen_random_uuid();

update public.assessments
set report_token = gen_random_uuid()
where report_token is null;

alter table public.assessments
  alter column report_token set not null;

create unique index if not exists assessments_report_token_key
  on public.assessments (report_token);

comment on column public.assessments.report_token is
  'Secret token for public /assessment/{slug}/report?token= links.';
