-- Editable overrides for the brand knowledge ("verbal canon") files that are
-- loaded into every Profit Coach AI prompt. Repo files remain the default;
-- a row here overrides the file content (works in production where the
-- filesystem is read-only).

create table if not exists public.brand_knowledge_files (
  file text primary key,
  content text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.brand_knowledge_files enable row level security;

drop policy if exists "brand_knowledge_admin_all" on public.brand_knowledge_files;
create policy "brand_knowledge_admin_all" on public.brand_knowledge_files
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
