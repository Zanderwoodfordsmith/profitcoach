-- Remove any remaining Laurie/Lauri Shaku* ladder level-up feed rows.
-- This intentionally uses broader matching than the previous cleanup migration.

delete from public.community_ladder_events e
where e.kind = 'level_up'
  and exists (
    select 1
    from public.profiles p
    where p.id = e.user_id
      and (
        (
          lower(coalesce(p.first_name, '')) like 'laur%'
          and lower(coalesce(p.last_name, '')) like 'shak%'
        )
        or lower(coalesce(p.full_name, '')) like '%laur%shak%'
      )
  );
