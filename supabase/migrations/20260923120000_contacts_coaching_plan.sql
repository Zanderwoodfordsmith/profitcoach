-- Per-client coaching workspace plan (3-year + shared 90-day spine).
alter table public.contacts
  add column if not exists coaching_plan jsonb;

comment on column public.contacts.coaching_plan is
  'Client coaching workspace document: 3-year plan, orbit areas, quarterly spine (shared with 90-day views).';
