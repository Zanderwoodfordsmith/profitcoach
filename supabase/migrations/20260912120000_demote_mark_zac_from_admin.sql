-- Demote Mark James and Zac Fagan from admin → coach (Pam + Zander remain admins).
-- Also harden sync_community_staff_snapshot: SELECT INTO with 0 coaches rows
-- previously nulled access_tier and blocked admin→coach role updates.

create or replace function public.sync_community_staff_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  coach_tier text := 'programme';
begin
  if tg_op = 'INSERT' then
    if new.role in ('coach', 'admin') then
      if new.role = 'coach' then
        select coalesce(c.access_tier, 'programme') into coach_tier
        from public.coaches c
        where c.id = new.id;
        -- No coaches row: SELECT INTO clears the variable; keep a safe default.
        coach_tier := coalesce(coach_tier, 'programme');
      else
        coach_tier := 'premium';
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
      if new.role = 'coach' then
        select coalesce(c.access_tier, 'programme') into coach_tier
        from public.coaches c
        where c.id = new.id;
        coach_tier := coalesce(coach_tier, 'programme');
      else
        coach_tier := 'premium';
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

-- Ensure coach rows exist before demotion (preserves premium access they already had).
insert into public.coaches (id, slug, record_kind, access_tier)
values
  ('9fa4ceb3-7605-42e2-b9a8-dd923814eac3', 'mark-james', 'member', 'premium'),
  ('4713d7f7-5733-4fcb-8559-4ad3befacffb', 'zac-fagan', 'member', 'premium')
on conflict (id) do update
set
  access_tier = coalesce(public.coaches.access_tier, excluded.access_tier),
  record_kind = coalesce(public.coaches.record_kind, excluded.record_kind);

update public.profiles
set role = 'coach'
where id in (
  '9fa4ceb3-7605-42e2-b9a8-dd923814eac3', -- Mark James
  '4713d7f7-5733-4fcb-8559-4ad3befacffb'  -- Zac Fagan
)
and role = 'admin';
