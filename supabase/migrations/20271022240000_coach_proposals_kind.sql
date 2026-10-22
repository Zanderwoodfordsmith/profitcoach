-- Welcome packs share the proposal engine (sections, private link, PDF,
-- send and track). kind says which one a row is.
alter table public.coach_proposals
  add column if not exists kind text not null default 'proposal';

alter table public.coach_proposals drop constraint if exists coach_proposals_kind_check;
alter table public.coach_proposals
  add constraint coach_proposals_kind_check check (kind in ('proposal', 'welcome'));

create index if not exists coach_proposals_coach_kind_idx on public.coach_proposals (coach_id, kind, updated_at desc);
