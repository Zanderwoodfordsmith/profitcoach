-- Per-coach VocalLab voice clones (TTS identity). Admin-enrolled for now.

create table if not exists public.coach_voices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'vocallab'
    check (provider in ('vocallab')),
  provider_voice_id text,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed', 'deleted')),
  display_name text,
  language text not null default 'en-GB',
  sample_transcript text,
  consent_at timestamptz,
  error_message text,
  constraint coach_voices_ready_needs_voice_id
    check (
      status <> 'ready'
      or (provider_voice_id is not null and length(trim(provider_voice_id)) > 0)
    )
);

create unique index if not exists coach_voices_one_active_per_coach
  on public.coach_voices (coach_id)
  where status in ('pending', 'ready', 'failed');

create index if not exists coach_voices_coach_id_idx
  on public.coach_voices (coach_id);

alter table public.coach_voices enable row level security;

drop policy if exists "Admins all coach_voices" on public.coach_voices;
create policy "Admins all coach_voices"
  on public.coach_voices for all
  to authenticated
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

-- Coaches can read their own ready voice later (generation consumers).
-- Self-serve enroll stays off until the product flag flips.
drop policy if exists "Coaches select own coach_voices" on public.coach_voices;
create policy "Coaches select own coach_voices"
  on public.coach_voices for select
  to authenticated
  using (coach_id = auth.uid());
