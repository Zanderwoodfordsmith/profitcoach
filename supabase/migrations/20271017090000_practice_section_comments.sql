-- Practice Blueprint: one comment thread per section, between the coach and
-- BCA, instead of notes at page level. Ava will post into the same threads.
-- Server-only: RLS on, no client policies. The API checks who may read and write.

create table if not exists public.practice_section_comments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  -- "page:id", the section key from the Blueprint map.
  section_key text not null,
  author_id uuid references public.profiles(id) on delete set null,
  -- Who wrote it: the coach, someone at BCA, or Ava.
  author_side text not null check (author_side in ('coach', 'bca', 'ava')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists practice_section_comments_thread_idx
  on public.practice_section_comments (coach_id, section_key, created_at);

alter table public.practice_section_comments enable row level security;

-- When each side last opened each thread. Every admin shares the BCA side.
create table if not exists public.practice_section_comment_reads (
  coach_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('coach', 'bca')),
  section_key text not null,
  read_at timestamptz not null default now(),
  primary key (coach_id, side, section_key)
);

alter table public.practice_section_comment_reads enable row level security;
