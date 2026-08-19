-- Admin-editable voice for LinkedIn Profile Optimizer rewrites.
-- Empty / missing row falls back to PROFILE_REWRITE_DEFAULT_VOICE in code.

create table if not exists public.linkedin_optimizer_prompt (
  id uuid primary key default gen_random_uuid(),
  system_prompt text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.linkedin_optimizer_prompt enable row level security;

drop policy if exists "Service role can manage linkedin_optimizer_prompt"
  on public.linkedin_optimizer_prompt;
create policy "Service role can manage linkedin_optimizer_prompt"
  on public.linkedin_optimizer_prompt for all
  to service_role
  using (true)
  with check (true);

revoke all on public.linkedin_optimizer_prompt from anon, authenticated;
grant all on public.linkedin_optimizer_prompt to service_role;
