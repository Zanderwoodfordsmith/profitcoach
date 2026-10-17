-- Editable overrides for Ava's context files (identity, router, capabilities,
-- references, practice-skills). Repo files remain the default; a row here
-- overrides the file (works in production where the filesystem is read-only).

create table if not exists public.agent_context_files (
  file text primary key,
  content text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.agent_context_files enable row level security;

drop policy if exists "agent_context_admin_all" on public.agent_context_files;
create policy "agent_context_admin_all" on public.agent_context_files
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
