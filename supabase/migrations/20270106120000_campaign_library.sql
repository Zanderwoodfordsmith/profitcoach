-- Admin campaign library: reusable templates, sequences, and individual steps.
-- Separate from live linkedin_campaigns (those send). Coaches have no access yet.

create table if not exists public.campaign_library_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null
    check (item_type in ('template', 'sequence', 'step')),
  kind text not null
    check (kind in ('connector', 'reactivation', 'nurture', 'positive_reply')),
  name text not null,
  description text,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_library_items_type_kind_idx
  on public.campaign_library_items (item_type, kind, updated_at desc);

create table if not exists public.campaign_library_steps (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.campaign_library_items (id) on delete cascade,
  position int not null check (position >= 0),
  step_type text not null
    check (
      step_type in (
        'invite',
        'message',
        'wait',
        'comment',
        'react',
        'visit',
        'follow',
        'email',
        'whatsapp',
        'instagram',
        'instagram_react',
        'instagram_comment',
        'instagram_follow',
        'messenger',
        'notify',
        'add_to_campaign',
        'call'
      )
    ),
  body text,
  wait_hours numeric(12, 4),
  variants jsonb not null default '[]'::jsonb,
  send_mode text not null default 'auto'
    check (send_mode in ('auto', 'remind')),
  fallback_hours numeric(10, 2),
  fallback_body text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, position)
);

create index if not exists campaign_library_steps_item_idx
  on public.campaign_library_steps (item_id, position);

create or replace function public.set_campaign_library_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_campaign_library_items_updated_at on public.campaign_library_items;
create trigger trg_campaign_library_items_updated_at
before update on public.campaign_library_items
for each row execute function public.set_campaign_library_updated_at();

drop trigger if exists trg_campaign_library_steps_updated_at on public.campaign_library_steps;
create trigger trg_campaign_library_steps_updated_at
before update on public.campaign_library_steps
for each row execute function public.set_campaign_library_updated_at();

alter table public.campaign_library_items enable row level security;
alter table public.campaign_library_steps enable row level security;

create policy "Admins manage campaign library items"
  on public.campaign_library_items
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

create policy "Admins manage campaign library steps"
  on public.campaign_library_steps
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
