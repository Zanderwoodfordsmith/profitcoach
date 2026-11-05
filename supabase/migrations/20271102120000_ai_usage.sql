-- Card 177: what each AI chat turn cost, so admin can see Ava use and cost per
-- coach (Coaches → Projects) and set a fair monthly allowance later (card 137).
-- One row per turn: Ava (runTurn) or the Create hub chat. Written by the server
-- with the service role; admins can read.

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- 'ava' or 'create_hub'
  surface text not null check (surface in ('ava', 'create_hub')),
  -- Who was talking: a coach about their own account, or an admin (BCA's cost of serving the coach).
  mode text not null check (mode in ('coach', 'admin')),
  actor_user_id uuid references public.profiles(id) on delete set null,
  coach_id uuid references public.profiles(id) on delete set null,
  -- ai_agent_chats.id for Ava, profit_coach_ai_chats.id for the Create hub.
  chat_id uuid,
  -- Ava capabilities open by the end of the turn, or the Create hub skill.
  skills text[] not null default '{}',
  model text not null,
  model_calls int not null default 1,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_usd numeric(12, 6) not null default 0
);

create index if not exists ai_usage_coach_created_idx on public.ai_usage (coach_id, created_at desc);
create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_admin_read" on public.ai_usage;
create policy "ai_usage_admin_read" on public.ai_usage
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
