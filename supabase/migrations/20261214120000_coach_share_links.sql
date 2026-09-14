-- Share hub: coach socials + custom resource links.

alter table public.profiles
  add column if not exists social_links jsonb not null default '{}'::jsonb;

comment on column public.profiles.social_links is
  'Allowlisted social URLs (instagram, facebook, youtube, tiktok, x, website). LinkedIn stays in linkedin_url.';

create table if not exists public.coach_custom_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  title text not null,
  url text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_custom_links_coach_idx
  on public.coach_custom_links (coach_id, sort_order, created_at);

drop trigger if exists trg_coach_custom_links_updated_at on public.coach_custom_links;
create trigger trg_coach_custom_links_updated_at
before update on public.coach_custom_links
for each row execute function public.set_linkedin_outreach_updated_at();

alter table public.coach_custom_links enable row level security;

create policy "Coaches read own custom links"
  on public.coach_custom_links for select
  using (auth.uid() = coach_id);

create policy "Coaches insert own custom links"
  on public.coach_custom_links for insert
  with check (auth.uid() = coach_id);

create policy "Coaches update own custom links"
  on public.coach_custom_links for update
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "Coaches delete own custom links"
  on public.coach_custom_links for delete
  using (auth.uid() = coach_id);

create policy "Admins read all custom links"
  on public.coach_custom_links for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
