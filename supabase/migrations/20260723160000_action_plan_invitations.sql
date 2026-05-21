-- Action plan invitations (preview + accept) and shareable links for Zoom.

create table if not exists public.action_plan_share_links (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.action_plan_templates(id) on delete cascade,
  token text not null unique,
  label text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists action_plan_share_links_template_id_idx
  on public.action_plan_share_links (template_id);

create table if not exists public.coach_action_plan_invitations (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.action_plan_templates(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  share_link_id uuid references public.action_plan_share_links(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  assignment_id uuid references public.coach_action_plan_assignments(id) on delete set null
);

create unique index if not exists coach_action_plan_invitations_pending_unique
  on public.coach_action_plan_invitations (template_id, coach_id)
  where status = 'pending';

create index if not exists coach_action_plan_invitations_coach_id_idx
  on public.coach_action_plan_invitations (coach_id, status);

create index if not exists coach_action_plan_invitations_template_id_idx
  on public.coach_action_plan_invitations (template_id, status);

alter table public.action_plan_share_links enable row level security;
alter table public.coach_action_plan_invitations enable row level security;

create policy "Admins manage action plan share links"
  on public.action_plan_share_links
  for all
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

create policy "Admins manage action plan invitations"
  on public.coach_action_plan_invitations
  for all
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

create policy "Coaches read own invitations"
  on public.coach_action_plan_invitations
  for select
  using (auth.uid() = coach_id);

create policy "Coaches update own invitations"
  on public.coach_action_plan_invitations
  for update
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "Coaches insert own invitations from share links"
  on public.coach_action_plan_invitations
  for insert
  with check (auth.uid() = coach_id);
