-- Coaching AI: complete setup (run this once in Supabase SQL Editor)
-- Step 1: Ensure contacts has user_id so RLS policies can reference it
alter table contacts add column if not exists user_id uuid references auth.users(id);

-- Step 2: Tables and seed
create table if not exists coach_ai_prompt (
  id uuid primary key default gen_random_uuid(),
  system_prompt text not null default '',
  updated_at timestamptz not null default now()
);

insert into coach_ai_prompt (system_prompt, updated_at)
select
  'You are a supportive business coach for the Boss Dashboard. You help business owners understand their Profit System scores and what to do next. Be warm, direct, and practical. Use simple language. Reference their playbooks and levels when relevant. Do not restate scores at length; focus on meaning and action.',
  now()
where not exists (select 1 from coach_ai_prompt limit 1);

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

create table if not exists coach_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references coach_chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists coach_chat_messages_chat_id on coach_chat_messages(chat_id);

-- Step 3: RLS
alter table coach_ai_prompt enable row level security;
alter table coach_chats enable row level security;
alter table coach_chat_messages enable row level security;

drop policy if exists "Service role can manage coach_ai_prompt" on coach_ai_prompt;
create policy "Service role can manage coach_ai_prompt"
  on coach_ai_prompt for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Contacts can manage own coach_chats" on coach_chats;
create policy "Contacts can manage own coach_chats"
  on coach_chats for all
  to authenticated
  using (
    contact_id in (select id from contacts where user_id = auth.uid())
  )
  with check (
    contact_id in (select id from contacts where user_id = auth.uid())
  );

drop policy if exists "Service role can manage coach_chats" on coach_chats;
create policy "Service role can manage coach_chats"
  on coach_chats for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Contacts can manage messages in own chats" on coach_chat_messages;
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

drop policy if exists "Service role can manage coach_chat_messages" on coach_chat_messages;
create policy "Service role can manage coach_chat_messages"
  on coach_chat_messages for all
  to service_role
  using (true)
  with check (true);
