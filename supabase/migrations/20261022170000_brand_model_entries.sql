-- Depth per model part (pillars, levels, areas): editable canonical copy and
-- an image library per entity, for reuse in content, blogs and decks.

create table if not exists public.brand_model_entries (
  entry_id text primary key,
  copy_md text,
  -- [{ path, url, caption }]
  images jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.brand_model_entries enable row level security;

drop policy if exists "brand_model_admin_all" on public.brand_model_entries;
create policy "brand_model_admin_all" on public.brand_model_entries
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

-- Public bucket for brand/model assets (images referenced in content).
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;
