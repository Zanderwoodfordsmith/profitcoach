-- Sales-call and other onboarding transcripts pulled for a coach's Blueprint.
-- Bodies are PII. Server-only writes. Cascade with the profile.

create table if not exists public.practice_source_transcripts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  source text not null default 'bca_sales_call'
    check (source in ('bca_sales_call')),
  external_id text not null,
  title text not null default '',
  called_at timestamptz,
  body text not null,
  ingested_at timestamptz not null default now(),
  unique (coach_id, source, external_id)
);

create index if not exists practice_source_transcripts_coach_idx
  on public.practice_source_transcripts (coach_id, called_at desc nulls last);

alter table public.practice_source_transcripts enable row level security;

create policy "Admins all practice_source_transcripts"
  on public.practice_source_transcripts
  for all to authenticated
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

create policy "Coaches select own practice_source_transcripts"
  on public.practice_source_transcripts
  for select to authenticated
  using (coach_id = auth.uid());

comment on table public.practice_source_transcripts is
  'Onboarding transcripts (BCA sales calls) Ava and Blueprint writers may read.';
