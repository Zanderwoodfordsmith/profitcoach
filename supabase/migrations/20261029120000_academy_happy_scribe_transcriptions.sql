-- Admin-controlled Happy Scribe transcription queue.
-- Transcript content remains in academy_lesson_content; these tables only
-- track provider jobs and the source snapshot used for each submission.

create table if not exists public.academy_transcription_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  provider text not null default 'happy_scribe'
    check (provider = 'happy_scribe'),
  service text not null default 'auto'
    check (service in ('auto', 'pro')),
  language text not null default 'en',
  provider_organization_id bigint,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  requested_count integer not null default 0
    check (requested_count >= 0),
  completed_count integer not null default 0
    check (completed_count >= 0),
  failed_count integer not null default 0
    check (failed_count >= 0),
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_transcription_runs_created_at_idx
  on public.academy_transcription_runs (created_at desc);

create table if not exists public.academy_transcription_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.academy_transcription_runs (id)
    on delete cascade,
  course_id text not null,
  lesson_id text not null,
  lesson_title text,
  kind text,
  parent_lesson_id text,
  parent_lesson_title text,
  source_url text not null,
  source_fingerprint text not null,
  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'submitting',
        'submitted',
        'processing',
        'exporting',
        'imported',
        'failed'
      )
    ),
  provider_order_id text,
  provider_transcription_id text,
  provider_export_id text,
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, course_id, lesson_id),
  unique (course_id, lesson_id, source_fingerprint)
);

create index if not exists academy_transcription_items_run_id_idx
  on public.academy_transcription_items (run_id);

create index if not exists academy_transcription_items_status_idx
  on public.academy_transcription_items (status, updated_at);

create unique index if not exists academy_transcription_items_provider_order_idx
  on public.academy_transcription_items (provider_order_id)
  where provider_order_id is not null;

alter table public.academy_transcription_runs enable row level security;
alter table public.academy_transcription_items enable row level security;

drop policy if exists "Admins read academy transcription runs"
  on public.academy_transcription_runs;
create policy "Admins read academy transcription runs"
  on public.academy_transcription_runs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins read academy transcription items"
  on public.academy_transcription_items;
create policy "Admins read academy transcription items"
  on public.academy_transcription_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
