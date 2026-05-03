-- BCA / Profit Coach ladder: self-serve current + goal on profiles, event log for level-ups.

-- Valid ladder level ids (single source of truth for CHECK + trigger)
-- bronze_i → black_diamond (12 steps)

alter table public.profiles
  add column if not exists ladder_level text;

alter table public.profiles
  add column if not exists ladder_goal_level text;

alter table public.profiles
  drop constraint if exists profiles_ladder_level_check;

alter table public.profiles
  add constraint profiles_ladder_level_check
  check (
    ladder_level is null
    or ladder_level in (
      'bronze_i',
      'bronze_ii',
      'bronze_iii',
      'silver',
      'gold',
      'platinum',
      'emerald',
      'ruby',
      'sapphire',
      'diamond',
      'blue_diamond',
      'black_diamond'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_ladder_goal_level_check;

alter table public.profiles
  add constraint profiles_ladder_goal_level_check
  check (
    ladder_goal_level is null
    or ladder_goal_level in (
      'bronze_i',
      'bronze_ii',
      'bronze_iii',
      'silver',
      'gold',
      'platinum',
      'emerald',
      'ruby',
      'sapphire',
      'diamond',
      'blue_diamond',
      'black_diamond'
    )
  );

create table if not exists public.community_ladder_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_level text,
  to_level text not null,
  kind text not null default 'level_up'
    check (kind in ('level_up', 'level_change')),
  created_at timestamptz not null default now()
);

create index if not exists community_ladder_events_created_at_idx
  on public.community_ladder_events (created_at desc);

create index if not exists community_ladder_events_user_id_idx
  on public.community_ladder_events (user_id);

alter table public.community_ladder_events enable row level security;

-- Coaches/admins signed into Supabase client can read events for the community sidebar.
drop policy if exists "Authenticated users read ladder events"
  on public.community_ladder_events;

create policy "Authenticated users read ladder events"
  on public.community_ladder_events
  for select
  to authenticated
  using (true);

-- Inserts only via trigger (SECURITY DEFINER); no direct client inserts.

create or replace function public.ladder_level_ordinal(level_id text)
returns int
language sql
immutable
as $$
  select case level_id
    when 'bronze_i' then 1
    when 'bronze_ii' then 2
    when 'bronze_iii' then 3
    when 'silver' then 4
    when 'gold' then 5
    when 'platinum' then 6
    when 'emerald' then 7
    when 'ruby' then 8
    when 'sapphire' then 9
    when 'diamond' then 10
    when 'blue_diamond' then 11
    when 'black_diamond' then 12
    else null
  end;
$$;

create or replace function public.log_profile_ladder_level_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_ord int;
  new_ord int;
  evt_kind text;
begin
  if old.ladder_level is not distinct from new.ladder_level then
    return new;
  end if;

  -- Only log when landing on a defined level (clears / demotions to null: no row)
  if new.ladder_level is null then
    return new;
  end if;

  old_ord := ladder_level_ordinal(old.ladder_level);
  new_ord := ladder_level_ordinal(new.ladder_level);

  if old_ord is null or new_ord > old_ord then
    evt_kind := 'level_up';
  else
    evt_kind := 'level_change';
  end if;

  insert into public.community_ladder_events (user_id, from_level, to_level, kind)
  values (new.id, old.ladder_level, new.ladder_level, evt_kind);

  return new;
end;
$$;

drop trigger if exists profiles_ladder_level_log on public.profiles;

create trigger profiles_ladder_level_log
  after update of ladder_level on public.profiles
  for each row
  execute procedure public.log_profile_ladder_level_change();
