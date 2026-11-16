-- Job 225 (16 Nov): read every chat with Ava to see how coaches use the app
-- and whether Ava answers well. Three things, all additive and server only
-- (RLS on, no client policies; the service role reads and writes):
--   1. ava_reply_marks: Good / Off on one Ava reply, from BCA (with a note
--      and the kind of fix) or from the coach (thumbs).
--   2. ava_chat_reviews: an AI's read of one chat (what they wanted, did Ava
--      do it, what went wrong), checked against BCA's marks.
--   3. ava_review_digests: the weekly "top things to fix".
-- Plus ava_chat_overview(), the Chats list without pulling every transcript.

create table if not exists public.ava_reply_marks (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.ai_agent_chats(id) on delete cascade,
  -- Which reply: how many of the person's messages came before it
  -- (1 = Ava's answer to their first message). Transcripts are append-only,
  -- so this never moves.
  turn int not null check (turn >= 0),
  source text not null check (source in ('bca', 'coach')),
  verdict text not null check (verdict in ('good', 'off')),
  -- BCA only: what an Off reply needs.
  fix text check (fix in ('knowledge', 'skill', 'app', 'coach')),
  note text,
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chat_id, turn, source)
);

create index if not exists ava_reply_marks_created_idx on public.ava_reply_marks (created_at desc);

alter table public.ava_reply_marks enable row level security;

create table if not exists public.ava_chat_reviews (
  chat_id uuid primary key references public.ai_agent_chats(id) on delete cascade,
  -- How many of the person's messages the review read; a chat that grows is read again.
  turns int not null,
  wanted text not null,
  outcome text not null check (outcome in ('done', 'partly', 'not_done', 'unclear')),
  problems text[] not null default '{}',
  summary text not null,
  fix text,
  fix_kind text check (fix_kind in ('knowledge', 'skill', 'app', 'coach')),
  model text not null,
  cost_usd numeric(12, 6) not null default 0,
  reviewed_at timestamptz not null default now()
);

-- Judging only Ava's replies, as BCA's marks do, so the two can be compared,
-- and which replies (turn numbers) went wrong.
alter table public.ava_chat_reviews
  add column if not exists verdict text not null default 'good' check (verdict in ('good', 'off')),
  add column if not exists off_turns int[] not null default '{}';

alter table public.ava_chat_reviews enable row level security;

create table if not exists public.ava_review_digests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- The chats it covered: reviewed since this time.
  period_start timestamptz not null,
  chats int not null,
  -- [{ "title", "why", "fix_kind", "chat_ids": [] }]
  items jsonb not null default '[]'::jsonb,
  model text not null,
  cost_usd numeric(12, 6) not null default 0
);

create index if not exists ava_review_digests_created_idx on public.ava_review_digests (created_at desc);

alter table public.ava_review_digests enable row level security;

-- Every chat for the list: who, when, skills, how many messages the person
-- sent (same rule as runTurn's personTurns) and the first page they were on.
create or replace function public.ava_chat_overview(p_limit int default 500)
returns table (
  id uuid,
  mode text,
  actor_user_id uuid,
  coach_id uuid,
  title text,
  created_at timestamptz,
  updated_at timestamptz,
  skills text[],
  person_turns int,
  first_page text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.mode,
    c.actor_user_id,
    c.coach_id,
    c.title,
    c.created_at,
    c.updated_at,
    c.opened_capabilities,
    (
      select count(*)::int
      from jsonb_array_elements(c.api_messages) m
      where m->>'role' = 'user'
        and jsonb_typeof(m->'content') = 'array'
        and exists (
          select 1
          from jsonb_array_elements(m->'content') b
          where b->>'type' = 'text'
            and b->>'text' not like '<working_state>%'
            and b->>'text' not like '<app_event>%'
        )
    ),
    (
      select substring(b->>'text' from 'Page open: ([^\n]+)')
      from jsonb_array_elements(c.api_messages) with ordinality as m(msg, i),
        jsonb_array_elements(
          case when jsonb_typeof(m.msg->'content') = 'array' then m.msg->'content' else '[]'::jsonb end
        ) b
      where m.msg->>'role' = 'user'
        and b->>'text' like '<working_state>%'
      order by m.i
      limit 1
    )
  from public.ai_agent_chats c
  where c.deleted_at is null
  order by c.updated_at desc
  limit greatest(1, least(p_limit, 2000));
$$;

revoke all on function public.ava_chat_overview(int) from public, anon, authenticated;
grant execute on function public.ava_chat_overview(int) to service_role;
