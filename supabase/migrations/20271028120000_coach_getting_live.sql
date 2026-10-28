-- Admin → Coaches → Getting live: the steps BCA ticks by hand for each coach
-- it is getting live (LinkedIn updated, coach signed off...), notes, and who
-- is on the list beyond the automatic one (joined since 1 Oct). The steps the
-- app already knows are worked out live, not stored here. Additive only.

create table if not exists public.coach_getting_live (
  coach_id uuid primary key references public.profiles (id) on delete cascade,
  -- Added from the "Add coach" picker, outside the automatic list.
  added_by_hand boolean not null default false,
  -- Taken off the list. Nothing else about the coach changes.
  hidden boolean not null default false,
  -- Steps ticked by hand: { "<step>": { "at": iso, "by": uuid } }.
  ticks jsonb not null default '{}'::jsonb,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.coach_getting_live enable row level security;

drop policy if exists "Admins manage getting live"
  on public.coach_getting_live;
create policy "Admins manage getting live"
  on public.coach_getting_live
  for all
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
