-- Use readable slug for Andrew McLachlan admin/public coach URLs.
update public.coaches
set slug = 'andy-mclachlan'
where slug = 'andy-3'
  and not exists (
    select 1
    from public.coaches existing
    where existing.slug = 'andy-mclachlan'
      and existing.id <> coaches.id
  );
