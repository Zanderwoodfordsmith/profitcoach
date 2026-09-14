-- Coach-facing alerts when a campaign or lead magnet does something.
-- Email / WhatsApp delivery from these rules is stored now; send comes later.

create table if not exists public.coach_watch_rules (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  scope_kind text not null check (scope_kind in ('campaign', 'magnet')),
  scope_id text not null,
  event text not null,
  in_app boolean not null default true,
  email boolean not null default false,
  whatsapp boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, scope_kind, scope_id, event)
);

create index if not exists coach_watch_rules_scope_idx
  on public.coach_watch_rules (coach_id, scope_kind, scope_id);

drop trigger if exists trg_coach_watch_rules_updated_at on public.coach_watch_rules;
create trigger trg_coach_watch_rules_updated_at
before update on public.coach_watch_rules
for each row execute function public.set_linkedin_outreach_updated_at();

alter table public.coach_watch_rules enable row level security;

create policy "Coaches read own watch rules"
  on public.coach_watch_rules for select
  using (auth.uid() = coach_id);

create policy "Admins read all watch rules"
  on public.coach_watch_rules for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
