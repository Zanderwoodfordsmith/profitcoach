-- Admin → Ava: a save history for every knowledge file, and who can use each
-- Ava skill. Additive only: two new tables, nothing else changes.
--
-- ava_file_versions: before a save (or a reset) replaces a file, the content
-- that was live goes here, so Admin → Ava can show History and Restore.
-- store 'agent' = agent_context_files (file is the path under content/);
-- store 'brand' = brand_knowledge_files (file is the brand file name).
-- saved_at / saved_by say who saved that content and when. A row with no
-- saved_by holds the repo file as it was before the first edit.
--
-- ava_skill_settings: one row per Ava skill whose access differs from the
-- default its CONTEXT.md frontmatter gives. No row = the default.
--   everyone: every coach, admins too
--   agent:    coaches with Ava switched on, admins too
--   admin:    admin mode only
--   off:      nobody can open it
--
-- Server only: RLS on, no policies, so only the service role reads or writes.

create table if not exists public.ava_file_versions (
  id bigint generated always as identity primary key,
  store text not null check (store in ('agent', 'brand')),
  file text not null,
  content text not null,
  saved_at timestamptz not null default now(),
  saved_by uuid
);

create index if not exists ava_file_versions_file_idx
  on public.ava_file_versions (store, file, id desc);

create table if not exists public.ava_skill_settings (
  skill_id text primary key,
  access text not null check (access in ('everyone', 'agent', 'admin', 'off')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.ava_file_versions enable row level security;
alter table public.ava_skill_settings enable row level security;
revoke all on public.ava_file_versions from anon, authenticated;
revoke all on public.ava_skill_settings from anon, authenticated;
grant all on public.ava_file_versions to service_role;
grant all on public.ava_skill_settings to service_role;
