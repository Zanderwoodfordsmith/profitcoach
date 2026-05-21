-- Admin action plan templates, coach groups, assignments, and unified coach action items.

create table if not exists public.action_plan_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.action_plan_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.action_plan_templates(id) on delete cascade,
  text text not null default '',
  depth int not null default 0 check (depth >= 0 and depth <= 6),
  sort_order int not null default 0,
  auto_complete_rule jsonb,
  created_at timestamptz not null default now()
);

create index if not exists action_plan_template_items_template_sort_idx
  on public.action_plan_template_items (template_id, sort_order);

create table if not exists public.coach_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_group_members (
  group_id uuid not null references public.coach_groups(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  primary key (group_id, coach_id)
);

create index if not exists coach_group_members_coach_id_idx
  on public.coach_group_members (coach_id);

create table if not exists public.coach_action_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.action_plan_templates(id) on delete restrict,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'archived'))
);

create unique index if not exists coach_action_plan_assignments_active_unique
  on public.coach_action_plan_assignments (template_id, coach_id)
  where status = 'active';

create index if not exists coach_action_plan_assignments_coach_id_idx
  on public.coach_action_plan_assignments (coach_id);

create index if not exists coach_action_plan_assignments_template_id_idx
  on public.coach_action_plan_assignments (template_id);

create table if not exists public.coach_action_items (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  assignment_id uuid references public.coach_action_plan_assignments(id) on delete cascade,
  template_item_id uuid references public.action_plan_template_items(id) on delete set null,
  text text not null default '',
  depth int not null default 0 check (depth >= 0 and depth <= 6),
  sort_order int not null default 0,
  estimate text not null default '',
  start_at timestamptz,
  due_at timestamptz,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  done boolean not null default false,
  done_at timestamptz,
  done_source text check (done_source is null or done_source in ('manual', 'auto')),
  is_locked boolean not null default false,
  auto_complete_rule jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_action_items_coach_sort_idx
  on public.coach_action_items (coach_id, sort_order);

create index if not exists coach_action_items_assignment_id_idx
  on public.coach_action_items (assignment_id);

-- RLS
alter table public.action_plan_templates enable row level security;
alter table public.action_plan_template_items enable row level security;
alter table public.coach_groups enable row level security;
alter table public.coach_group_members enable row level security;
alter table public.coach_action_plan_assignments enable row level security;
alter table public.coach_action_items enable row level security;

create policy "Admins manage action plan templates"
  on public.action_plan_templates
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

create policy "Admins manage action plan template items"
  on public.action_plan_template_items
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

create policy "Admins manage coach groups"
  on public.coach_groups
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

create policy "Admins manage coach group members"
  on public.coach_group_members
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

create policy "Admins manage action plan assignments"
  on public.coach_action_plan_assignments
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

create policy "Coaches read own action plan assignments"
  on public.coach_action_plan_assignments
  for select
  using (auth.uid() = coach_id);

create policy "Coaches manage own action items"
  on public.coach_action_items
  for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "Admins read all action items"
  on public.coach_action_items
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
