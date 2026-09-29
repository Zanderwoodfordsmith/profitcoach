-- Practice Installation knowledge store: one record per coach, interview
-- sessions, Decision Records, and proof-file uploads.

create table if not exists public.coach_practice_knowledge (
  coach_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'capturing'
    check (status in (
      'capturing',
      'extracted',
      'coach_reviewed',
      'admin_reviewed',
      'decision_recorded',
      'ready_to_build',
      'building'
    )),
  payload jsonb not null default '{}'::jsonb,
  linkedin_seeded_at timestamptz,
  form_completed_at timestamptz,
  interview_completed_at timestamptz,
  coach_reviewed_at timestamptz,
  admin_reviewed_at timestamptz,
  completeness_score smallint not null default 0,
  missing_fields text[] not null default '{}'::text[],
  report_payload jsonb,
  report_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  turns jsonb not null default '[]'::jsonb,
  extraction jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_intake_sessions_coach_id_idx
  on public.coach_intake_sessions (coach_id, started_at desc);

create table if not exists public.coach_decision_records (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  locked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_decision_records_coach_id_idx
  on public.coach_decision_records (coach_id, created_at desc);

create table if not exists public.coach_intake_assets (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('cv', 'testimonial', 'case_study', 'other')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  created_at timestamptz not null default now()
);

create index if not exists coach_intake_assets_coach_id_idx
  on public.coach_intake_assets (coach_id, created_at desc);

alter table public.coach_practice_knowledge enable row level security;
alter table public.coach_intake_sessions enable row level security;
alter table public.coach_decision_records enable row level security;
alter table public.coach_intake_assets enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'coach_practice_knowledge',
    'coach_intake_sessions',
    'coach_decision_records',
    'coach_intake_assets'
  ]
  loop
    execute format('drop policy if exists "Coaches select own %s" on public.%I', t, t);
    execute format(
      'create policy "Coaches select own %s" on public.%I for select to authenticated using (coach_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "Coaches insert own %s" on public.%I', t, t);
    execute format(
      'create policy "Coaches insert own %s" on public.%I for insert to authenticated with check (coach_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "Coaches update own %s" on public.%I', t, t);
    execute format(
      'create policy "Coaches update own %s" on public.%I for update to authenticated using (coach_id = auth.uid()) with check (coach_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "Coaches delete own %s" on public.%I', t, t);
    execute format(
      'create policy "Coaches delete own %s" on public.%I for delete to authenticated using (coach_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "Admins all %s" on public.%I', t, t);
    execute format(
      'create policy "Admins all %s" on public.%I for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin'')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))',
      t, t
    );
  end loop;
end $$;

comment on table public.coach_practice_knowledge is
  'Practice Installation knowledge: form + LinkedIn seed + interview, one row per coach';
comment on table public.coach_intake_sessions is
  'Conversational interview turns and extraction for Practice Installation';
comment on table public.coach_decision_records is
  'One-page Decision Record after the Decision Call';
comment on table public.coach_intake_assets is
  'Proof uploads (CV, testimonials, case studies) for Practice Installation';
