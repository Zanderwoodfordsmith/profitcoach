-- Unipile calendar prefs for native booking (busy blocking + event create).
-- Tokens live on Unipile; this table only stores which calendars to use.

create table if not exists public.coach_unipile_calendar_prefs (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  unipile_account_id text not null,
  busy_calendar_ids text[] not null default '{}',
  event_calendar_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coach_unipile_calendar_prefs is
  'Which Unipile Google/Outlook calendars block availability and receive booking events. Service-role only.';

create or replace function public.set_coach_unipile_calendar_prefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coach_unipile_calendar_prefs_updated_at
  on public.coach_unipile_calendar_prefs;
create trigger trg_coach_unipile_calendar_prefs_updated_at
before update on public.coach_unipile_calendar_prefs
for each row execute function public.set_coach_unipile_calendar_prefs_updated_at();

alter table public.coach_unipile_calendar_prefs enable row level security;
