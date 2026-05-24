-- Coach workshop notes keyed by BOSS playbook ref (e.g. "5.0", "3.4").
alter table public.contacts
  add column if not exists playbook_session_notes jsonb not null default '{}'::jsonb;

comment on column public.contacts.playbook_session_notes is
  'JSON object keyed by playbook ref — coach-only session notes per playbook during live scoring.';
