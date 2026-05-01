-- Coach AI chat folders: up to 2 levels (folder -> subfolder).
-- Chats can be placed in a folder or uncategorized (folder_id null).

create table if not exists coach_chat_folders (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  parent_id uuid references coach_chat_folders(id) on delete restrict,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_chat_folders_contact_id on coach_chat_folders(contact_id);
create index if not exists coach_chat_folders_contact_parent on coach_chat_folders(contact_id, parent_id);

alter table coach_chats add column if not exists folder_id uuid references coach_chat_folders(id) on delete set null;
create index if not exists coach_chats_folder_id on coach_chats(folder_id);

alter table coach_chat_folders enable row level security;

drop policy if exists "Contacts can manage own coach_chat_folders" on coach_chat_folders;
create policy "Contacts can manage own coach_chat_folders"
  on coach_chat_folders for all
  to authenticated
  using (
    contact_id in (select id from contacts where user_id = auth.uid())
  )
  with check (
    contact_id in (select id from contacts where user_id = auth.uid())
  );

drop policy if exists "Service role can manage coach_chat_folders" on coach_chat_folders;
create policy "Service role can manage coach_chat_folders"
  on coach_chat_folders for all
  to service_role
  using (true)
  with check (true);
