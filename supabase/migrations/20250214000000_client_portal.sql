-- Client portal: link contacts to auth users, add playbook unlocks

-- Link contact to auth user when client is activated (gets login)
alter table contacts add column if not exists user_id uuid references auth.users(id);

-- Playbook unlocks: coach unlocks playbooks per client (contact)
create table if not exists client_playbook_unlocks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  playbook_ref text not null,
  unlocked_at timestamptz not null default now(),
  unique(contact_id, playbook_ref)
);

create index if not exists client_playbook_unlocks_contact_id on client_playbook_unlocks(contact_id);
