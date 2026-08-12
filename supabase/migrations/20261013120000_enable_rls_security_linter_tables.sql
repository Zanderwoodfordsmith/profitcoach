-- Fix Supabase security linter: enable RLS on public tables that were exposed
-- without it (and/or had policies while RLS was off).
-- App access is via service role (bypasses RLS). Dreamlit select policies on
-- landing_* / playbook_* remain and become effective once RLS is on.

alter table public.landing_events enable row level security;
alter table public.landing_tests enable row level security;
alter table public.playbook_content enable row level security;
alter table public.playbook_tab_status enable row level security;
alter table public.linkedin_scheduled_posts enable row level security;
alter table public.client_playbook_unlocks enable row level security;

comment on table public.linkedin_scheduled_posts is
  'LinkedIn post queue. RLS on; writes/reads via service role from admin APIs.';

comment on table public.client_playbook_unlocks is
  'Per-contact playbook unlock/status. RLS on; access via service role from API routes.';
