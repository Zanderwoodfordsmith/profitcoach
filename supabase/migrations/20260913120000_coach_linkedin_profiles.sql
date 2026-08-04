-- Coach LinkedIn profile snapshots (Apify import). One current snapshot per coach.

create table if not exists public.coach_linkedin_profiles (
  coach_id uuid primary key references public.profiles (id) on delete cascade,
  linkedin_url text not null,
  scraped_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists coach_linkedin_profiles_scraped_at_idx
  on public.coach_linkedin_profiles (scraped_at desc);

alter table public.coach_linkedin_profiles enable row level security;

drop policy if exists "Coaches read own linkedin profile"
  on public.coach_linkedin_profiles;
create policy "Coaches read own linkedin profile"
  on public.coach_linkedin_profiles
  for select
  to authenticated
  using (coach_id = auth.uid());

drop policy if exists "Coaches upsert own linkedin profile"
  on public.coach_linkedin_profiles;
create policy "Coaches upsert own linkedin profile"
  on public.coach_linkedin_profiles
  for insert
  to authenticated
  with check (coach_id = auth.uid());

drop policy if exists "Coaches update own linkedin profile"
  on public.coach_linkedin_profiles;
create policy "Coaches update own linkedin profile"
  on public.coach_linkedin_profiles
  for update
  to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Coaches delete own linkedin profile"
  on public.coach_linkedin_profiles;
create policy "Coaches delete own linkedin profile"
  on public.coach_linkedin_profiles
  for delete
  to authenticated
  using (coach_id = auth.uid());

drop policy if exists "Admins read coach linkedin profiles"
  on public.coach_linkedin_profiles;
create policy "Admins read coach linkedin profiles"
  on public.coach_linkedin_profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
