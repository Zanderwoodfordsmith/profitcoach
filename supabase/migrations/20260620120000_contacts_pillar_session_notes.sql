-- Coach workshop / sales-call notes keyed by BOSS pillar (foundation, vision, velocity, value).
alter table public.contacts
  add column if not exists pillar_session_notes jsonb not null default '{}'::jsonb;

comment on column public.contacts.pillar_session_notes is
  'JSON object with optional keys foundation, vision, velocity, value — coach-only session notes per pillar.';
