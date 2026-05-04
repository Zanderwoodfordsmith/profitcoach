-- Coach-facing Profit Coach AI: persisted chats + optional brain (ai_context on profiles)

alter table public.profiles
  add column if not exists ai_context jsonb not null default '{}'::jsonb;

create table if not exists public.profit_coach_ai_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  last_output_id text,
  last_role_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profit_coach_ai_chats_user_updated_idx
  on public.profit_coach_ai_chats (user_id, updated_at desc);

create table if not exists public.profit_coach_ai_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.profit_coach_ai_chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists profit_coach_ai_messages_chat_created_idx
  on public.profit_coach_ai_messages (chat_id, created_at);

alter table public.profit_coach_ai_chats enable row level security;
alter table public.profit_coach_ai_messages enable row level security;

drop policy if exists "Users manage own profit_coach_ai_chats" on public.profit_coach_ai_chats;
create policy "Users manage own profit_coach_ai_chats"
  on public.profit_coach_ai_chats
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage messages in own profit_coach_ai_chats" on public.profit_coach_ai_messages;
create policy "Users manage messages in own profit_coach_ai_chats"
  on public.profit_coach_ai_messages
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profit_coach_ai_chats c
      where c.id = chat_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profit_coach_ai_chats c
      where c.id = chat_id and c.user_id = auth.uid()
    )
  );
