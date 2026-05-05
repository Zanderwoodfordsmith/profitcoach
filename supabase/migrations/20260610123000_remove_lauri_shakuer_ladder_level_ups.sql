-- Remove historical ladder level-up feed items for Lauri Shakuer.
-- This only deletes rows from the public level-up feed table.

delete from public.community_ladder_events e
where exists (
  select 1
  from public.profiles p
  where p.id = e.user_id
    and (
      lower(coalesce(p.full_name, '')) in (
        'lauri shakuer',
        'lauri shakur',
        'laurie shakuer',
        'laurie shakur'
      )
      or (
        lower(coalesce(p.first_name, '')) in ('lauri', 'laurie')
        and lower(coalesce(p.last_name, '')) like 'shak%'
      )
    )
)
and e.kind = 'level_up';
