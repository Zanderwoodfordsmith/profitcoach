-- Admin spike: last LinkedIn Messaging mirror pushed from the Chrome extension.
create table if not exists public.linkedin_inbox_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  conversations jsonb not null default '[]'::jsonb,
  scraped_at timestamptz not null default now(),
  source text not null default 'extension',
  warning text,
  updated_at timestamptz not null default now()
);

comment on table public.linkedin_inbox_snapshots is
  'Latest LinkedIn inbox mirror per admin user (extension scrape; not live OAuth).';

alter table public.linkedin_inbox_snapshots enable row level security;

create policy "linkedin_inbox_snapshots_service_role"
  on public.linkedin_inbox_snapshots
  for all
  to service_role
  using (true)
  with check (true);
