-- LinkedIn newsletter planner: series (named newsletter) + edition drafts.
-- Publishing still happens by copy/paste into LinkedIn's newsletter UI.

create table if not exists public.linkedin_newsletter_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  tagline text null,
  cadence text not null default 'fortnightly'
    check (cadence in ('weekly', 'fortnightly', 'monthly')),
  lead_topic text null,
  overview_537 jsonb not null default '{}'::jsonb,
  fixed_blocks jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkedin_newsletter_series_user_idx
  on public.linkedin_newsletter_series (user_id, updated_at desc);

create table if not exists public.linkedin_newsletter_editions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.linkedin_newsletter_series (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sequence_index int not null,
  kind text not null
    check (kind in (
      'overview_537',
      'strategy',
      'mistake',
      'checklist',
      'profit_system',
      'industry',
      'custom'
    )),
  kind_index int null,
  title text not null default '',
  tagline text null,
  format text not null default 'pam_deep_dive'
    check (format in (
      'pam_537_overview',
      'pam_deep_dive',
      'quick_insight',
      'timely_pov',
      'in_depth',
      'breezy_story',
      'curated_roundup'
    )),
  length_mode text not null default 'short'
    check (length_mode in ('short', 'long')),
  seo_title text null,
  seo_description text null,
  body_markdown text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  promo_post_text text null,
  cover jsonb not null default '{}'::jsonb,
  status text not null default 'planned'
    check (status in ('planned', 'draft', 'ready', 'copied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, sequence_index)
);

create index if not exists linkedin_newsletter_editions_series_idx
  on public.linkedin_newsletter_editions (series_id, sequence_index);

create index if not exists linkedin_newsletter_editions_user_idx
  on public.linkedin_newsletter_editions (user_id, updated_at desc);

alter table public.linkedin_newsletter_series enable row level security;
alter table public.linkedin_newsletter_editions enable row level security;

-- Service role / admin APIs use supabaseAdmin; no broad authenticated policies.
