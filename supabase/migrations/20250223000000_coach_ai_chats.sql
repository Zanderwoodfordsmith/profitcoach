-- Coaching AI: admin prompt config, chats per contact, messages per chat

-- Single-row config for Coaching AI system prompt (admin-editable)
create table if not exists coach_ai_prompt (
  id uuid primary key default gen_random_uuid(),
  system_prompt text not null default '',
  updated_at timestamptz not null default now()
);

-- Seed one row when table is empty
insert into coach_ai_prompt (system_prompt, updated_at)
select
  'You are a supportive business coach for the Boss Dashboard. You help business owners understand their Profit System scores and what to do next. Be warm, direct, and practical. Use simple language. Reference their playbooks and levels when relevant. Do not restate scores at length; focus on meaning and action.',
  now()
where not exists (select 1 from coach_ai_prompt limit 1);

-- Chats: one per conversation, scoped by contact
create table if not exists coach_chats (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  title text,
  section_context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_chats_contact_id on coach_chats(contact_id);
create index if not exists coach_chats_updated_at on coach_chats(contact_id, updated_at desc);

-- Messages: user and assistant turns
create table if not exists coach_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references coach_chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists coach_chat_messages_chat_id on coach_chat_messages(chat_id);

-- RLS: clients can only access their own chats (contacts.user_id = auth.uid())
alter table coach_ai_prompt enable row level security;
alter table coach_chats enable row level security;
alter table coach_chat_messages enable row level security;

-- coach_ai_prompt: only backend (service role) reads/writes; admin and chat API use Next.js with service role
create policy "Service role can manage coach_ai_prompt"
  on coach_ai_prompt for all
  to service_role
  using (true)
  with check (true);

-- coach_chats: contact can CRUD own
create policy "Contacts can manage own coach_chats"
  on coach_chats for all
  to authenticated
  using (
    contact_id in (select id from contacts where user_id = auth.uid())
  )
  with check (
    contact_id in (select id from contacts where user_id = auth.uid())
  );

create policy "Service role can manage coach_chats"
  on coach_chats for all
  to service_role
  using (true)
  with check (true);

-- coach_chat_messages: via chat ownership
create policy "Contacts can manage messages in own chats"
  on coach_chat_messages for all
  to authenticated
  using (
    chat_id in (
      select id from coach_chats
      where contact_id in (select id from contacts where user_id = auth.uid())
    )
  )
  with check (
    chat_id in (
      select id from coach_chats
      where contact_id in (select id from contacts where user_id = auth.uid())
    )
  );

create policy "Service role can manage coach_chat_messages"
  on coach_chat_messages for all
  to service_role
  using (true)
  with check (true);
