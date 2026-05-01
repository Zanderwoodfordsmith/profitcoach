-- Coach self-evaluation scores for Signature Model (12 modules).
-- null in JSON values = not scored (transparent); non-null: red | yellow | green

create table if not exists coach_signature_scores (
  user_id uuid primary key references profiles(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists coach_signature_scores_updated_at_idx
  on coach_signature_scores (updated_at desc);

alter table coach_signature_scores enable row level security;

create policy "Coaches manage own signature scores"
  on coach_signature_scores
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins read all signature scores"
  on coach_signature_scores
  for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
