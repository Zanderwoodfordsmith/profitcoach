-- A coach's own LinkedIn history, imported through their connected account
-- (Unipile): every post with its numbers, and each newsletter issue in full.
-- Feeds the Content calendar, the Newsletter tab, Insights and coach health.
-- Re-imports refresh the numbers; nothing here is written back to LinkedIn.

create table if not exists public.linkedin_post_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id text not null,
  social_id text null,
  posted_at timestamptz not null,
  kind text not null default 'post'
    check (kind in ('post', 'repost', 'newsletter', 'article')),
  text text not null default '',
  share_url text null,
  article_id text null,
  attachments jsonb not null default '[]'::jsonb,
  impressions int not null default 0,
  reactions int not null default 0,
  comments int not null default 0,
  reposts int not null default 0,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists linkedin_post_history_user_posted_idx
  on public.linkedin_post_history (user_id, posted_at desc);

-- One row per issue, however many times it was shared in the feed.
create table if not exists public.linkedin_newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id text not null,
  url text not null,
  title text not null default '',
  published_at timestamptz not null,
  newsletter_name text null,
  newsletter_url text null,
  topic text null,
  headings jsonb null,
  cover_url text null,
  excerpt text null,
  body_blocks jsonb null,
  body_chars int null,
  body_fetched_at timestamptz null,
  impressions int not null default 0,
  reactions int not null default 0,
  comments int not null default 0,
  reposts int not null default 0,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, article_id)
);

create index if not exists linkedin_newsletter_issues_user_published_idx
  on public.linkedin_newsletter_issues (user_id, published_at desc);

-- When each coach was last imported, so the daily refresh picks the stalest.
create table if not exists public.linkedin_history_imports (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_run_at timestamptz null,
  last_ok_at timestamptz null,
  full_import_at timestamptz null,
  last_post_at timestamptz null,
  posts int not null default 0,
  issues int not null default 0,
  last_error text null
);

alter table public.linkedin_post_history enable row level security;
alter table public.linkedin_newsletter_issues enable row level security;
alter table public.linkedin_history_imports enable row level security;

-- Service role / API routes use supabaseAdmin; no broad authenticated policies.
