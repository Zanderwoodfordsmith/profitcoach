-- Practice Blueprint: sections BCA writes for the coach (avatar, pain points,
-- campaign messages, LinkedIn rewrite, and so on). Keyed "page:section".
-- Each value holds typed blocks, the model used, and when it was generated.
alter table public.coach_practice_knowledge
  add column if not exists built_sections jsonb not null default '{}'::jsonb;

comment on column public.coach_practice_knowledge.built_sections is
  'Blueprint sections BCA generated for the coach, keyed page:section. Blocks + meta.';
