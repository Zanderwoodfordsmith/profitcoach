-- Per-client playbook status: locked | in_progress | implemented
-- Locked = client sees overview only; in_progress/implemented = client sees overview + client tab

alter table client_playbook_unlocks
  add column if not exists status text not null default 'implemented'
  check (status in ('locked', 'in_progress', 'implemented'));
