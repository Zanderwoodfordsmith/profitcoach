-- A/B is two versions. Drop C/D/extra keys from live campaigns and the library.

update public.linkedin_campaign_steps
set variants = coalesce((
  select jsonb_agg(t.elem order by t.rank, t.ord)
  from (
    select
      e.elem,
      e.ord,
      case e.elem->>'key' when 'A' then 0 else 1 end as rank
    from jsonb_array_elements(variants) with ordinality as e(elem, ord)
    where e.elem->>'key' in ('A', 'B')
  ) t
), '[]'::jsonb)
where jsonb_typeof(variants) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(variants) as extra
    where coalesce(extra->>'key', '') not in ('A', 'B')
  );

update public.campaign_library_steps
set variants = coalesce((
  select jsonb_agg(t.elem order by t.rank, t.ord)
  from (
    select
      e.elem,
      e.ord,
      case e.elem->>'key' when 'A' then 0 else 1 end as rank
    from jsonb_array_elements(variants) with ordinality as e(elem, ord)
    where e.elem->>'key' in ('A', 'B')
  ) t
), '[]'::jsonb)
where jsonb_typeof(variants) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(variants) as extra
    where coalesce(extra->>'key', '') not in ('A', 'B')
  );
