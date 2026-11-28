-- Curriculum drafts (28 Nov 2026): the proposed new curriculum, edited on
-- Academy → Curriculum → New plan. One row per draft, the whole plan as JSON.
-- Admin API only (service role), so no policies.
create table if not exists public.curriculum_drafts (
  id text primary key,
  plan jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.curriculum_drafts enable row level security;
