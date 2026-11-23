-- Help centre: "Did this answer your question?" (23 Nov). One thumbs up or
-- down per person per answer; they can change it. A No can carry what they
-- still need, which also opens a Support chat about that answer (ticket_id).
-- answer_id is the id in src/lib/help/helpAnswers.ts. Additive only.

create table if not exists public.help_answer_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answer_id text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  helpful boolean not null,
  comment text,
  ticket_id uuid references public.community_feedback_reports(id) on delete set null,
  constraint help_answer_feedback_one_per_person unique (answer_id, created_by),
  constraint help_answer_feedback_comment_max check (comment is null or char_length(comment) <= 2000)
);

create index if not exists help_answer_feedback_answer_idx
  on public.help_answer_feedback (answer_id);

alter table public.help_answer_feedback enable row level security;

drop policy if exists "Read own or admin help answer feedback" on public.help_answer_feedback;
create policy "Read own or admin help answer feedback"
  on public.help_answer_feedback for select to authenticated
  using (created_by = auth.uid() or public.is_admin());

drop policy if exists "Insert own help answer feedback" on public.help_answer_feedback;
create policy "Insert own help answer feedback"
  on public.help_answer_feedback for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Update own help answer feedback" on public.help_answer_feedback;
create policy "Update own help answer feedback"
  on public.help_answer_feedback for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

grant select, insert, update on public.help_answer_feedback to authenticated;
