-- Profit Coach ladder v2: per-level achievement dates as canonical source of truth.
-- Replaces profiles.ladder_level (single column) with a community_ladder_achievements
-- table keyed on (user_id, level_id) with a date the coach hit that level.
-- Adds an optional target date for the ultimate goal level.

-- 1. New achievement table
create table if not exists public.community_ladder_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_id text not null,
  -- Optional: coaches can tick a level without recording a marketing date (null).
  achieved_on date,
  created_at timestamptz not null default now(),
  primary key (user_id, level_id),
  check (
    level_id in (
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
  )
);

create index if not exists community_ladder_achievements_user_id_idx
  on public.community_ladder_achievements (user_id);

create index if not exists community_ladder_achievements_achieved_on_idx
  on public.community_ladder_achievements (achieved_on desc);

alter table public.community_ladder_achievements enable row level security;

-- Coach: read/insert/update/delete own achievements.
drop policy if exists "Coach reads own achievements"
  on public.community_ladder_achievements;
create policy "Coach reads own achievements"
  on public.community_ladder_achievements
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Coach writes own achievements"
  on public.community_ladder_achievements;
create policy "Coach writes own achievements"
  on public.community_ladder_achievements
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Coach updates own achievements"
  on public.community_ladder_achievements;
create policy "Coach updates own achievements"
  on public.community_ladder_achievements
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach deletes own achievements"
  on public.community_ladder_achievements;
create policy "Coach deletes own achievements"
  on public.community_ladder_achievements
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Staff (community-aware) can read everyone's achievements for the sidebar / admin tools.
drop policy if exists "Staff reads achievements"
  on public.community_ladder_achievements;
create policy "Staff reads achievements"
  on public.community_ladder_achievements
  for select
  to authenticated
  using (public.is_staff_community());

-- 2. Goal target date column
alter table public.profiles
  add column if not exists ladder_goal_target_date date;

-- 3. Fire community_ladder_events level_up only when the new achievement
--    raises the user's ceiling.
create or replace function public.log_ladder_achievement_level_up()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_max_ord int;
  new_ord int;
  prior_max_id text;
begin
  new_ord := public.ladder_level_ordinal(new.level_id);
  if new_ord is null then
    return new;
  end if;

  select coalesce(max(public.ladder_level_ordinal(level_id)), 0)
    into prior_max_ord
  from public.community_ladder_achievements
  where user_id = new.user_id
    and level_id <> new.level_id;

  if new_ord <= coalesce(prior_max_ord, 0) then
    return new;
  end if;

  if prior_max_ord > 0 then
    select level_id into prior_max_id
    from public.community_ladder_achievements
    where user_id = new.user_id
      and level_id <> new.level_id
      and public.ladder_level_ordinal(level_id) = prior_max_ord
    limit 1;
  end if;

  insert into public.community_ladder_events (
    user_id, from_level, to_level, kind, created_at
  )
  values (
    new.user_id,
    prior_max_id,
    new.level_id,
    'level_up',
    coalesce(new.achieved_on::timestamptz, now())
  );

  return new;
end;
$$;

drop trigger if exists community_ladder_achievements_levelup
  on public.community_ladder_achievements;

create trigger community_ladder_achievements_levelup
  after insert on public.community_ladder_achievements
  for each row
  execute procedure public.log_ladder_achievement_level_up();

-- 4. Backfill any pre-existing profiles.ladder_level values into achievements.
--    No timestamp known, so use current_date (coaches can edit after).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'ladder_level'
  ) then
    insert into public.community_ladder_achievements (user_id, level_id, achieved_on)
    select id, ladder_level, current_date
    from public.profiles
    where ladder_level is not null
    on conflict (user_id, level_id) do nothing;
  end if;
end $$;

-- 5. Drop the legacy single-column model and its trigger.
drop trigger if exists profiles_ladder_level_log on public.profiles;
drop function if exists public.log_profile_ladder_level_change();

alter table public.profiles
  drop constraint if exists profiles_ladder_level_check;

alter table public.profiles
  drop column if exists ladder_level;
