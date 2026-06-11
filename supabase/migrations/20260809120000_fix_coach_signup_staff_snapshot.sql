-- Fix coach signup: sync_community_staff_snapshot must keep access_tier = 'pro'
-- when the coaches row does not exist yet (SELECT INTO with no rows sets NULL).

create or replace function public.sync_community_staff_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  coach_tier text := 'pro';
begin
  if tg_op = 'INSERT' then
    if new.role in ('coach', 'admin') then
      if new.role = 'coach' then
        select c.access_tier into coach_tier
        from public.coaches c
        where c.id = new.id;
        coach_tier := coalesce(coach_tier, 'pro');
      end if;
      insert into public.community_staff_snapshot (user_id, staff_role, access_tier)
      values (new.id, new.role::text, coach_tier)
      on conflict (user_id) do update
        set staff_role = excluded.staff_role,
            access_tier = excluded.access_tier;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role in ('coach', 'admin') then
      coach_tier := 'pro';
      if new.role = 'coach' then
        select c.access_tier into coach_tier
        from public.coaches c
        where c.id = new.id;
        coach_tier := coalesce(coach_tier, 'pro');
      end if;
      insert into public.community_staff_snapshot (user_id, staff_role, access_tier)
      values (new.id, new.role::text, coach_tier)
      on conflict (user_id) do update
        set staff_role = excluded.staff_role,
            access_tier = excluded.access_tier;
    else
      delete from public.community_staff_snapshot where user_id = new.id;
    end if;
    return new;
  end if;

  return new;
end;
$fn$;
