-- Ava's plain line on what each company does (Check fit, job 285, 25 Nov):
-- written once from its description, so a coach reads it in a glance.
alter table public.linkedin_companies
  add column if not exists summary text;
