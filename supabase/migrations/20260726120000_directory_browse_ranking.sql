-- Directory browse ranking: when there is no search/level/location filter,
-- surface coaches with a photo first, then coaches with a summary/bio, then by name.
-- When any filter is applied, keep the simple alphabetical ordering.

drop function if exists public.directory_coaches_page(text, text, text, int, int);

create function public.directory_coaches_page(
  p_search text,
  p_level text,
  p_location text,
  p_limit int,
  p_offset int
)
returns table (
  slug text,
  directory_level text,
  full_name text,
  coach_business_name text,
  avatar_url text,
  directory_summary text,
  location text,
  linkedin_url text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select (
      coalesce(btrim(p_search), '') = ''
      and coalesce(btrim(p_level), '') = ''
      and coalesce(btrim(p_location), '') = ''
    ) as is_browse
  ),
  filtered as (
    select
      c.slug,
      c.directory_level,
      p.full_name,
      p.coach_business_name,
      p.avatar_url,
      coalesce(nullif(btrim(p.directory_summary), ''), p.bio) as directory_summary,
      p.location,
      p.linkedin_url,
      case
        when p.avatar_url is not null and btrim(p.avatar_url) <> '' then 0
        else 1
      end as photo_rank,
      case
        when coalesce(
          nullif(btrim(p.directory_summary), ''),
          nullif(btrim(p.directory_bio), ''),
          nullif(btrim(p.bio), '')
        ) is not null then 0
        else 1
      end as summary_rank
    from coaches c
    inner join profiles p on p.id = c.id
    where c.directory_listed = true
      and (p_level is null or btrim(p_level) = '' or c.directory_level = p_level)
      and (p_location is null or btrim(p_location) = '' or p.location ilike '%' || p_location || '%')
      and (
        p_search is null or btrim(p_search) = ''
        or p.full_name ilike '%' || p_search || '%'
        or coalesce(p.coach_business_name, '') ilike '%' || p_search || '%'
        or coalesce(nullif(btrim(p.directory_summary), ''), p.bio, '') ilike '%' || p_search || '%'
        or coalesce(nullif(btrim(p.directory_bio), ''), '') ilike '%' || p_search || '%'
      )
  ),
  numbered as (
    select f.*, count(*) over () as total_count
    from filtered f
  )
  select
    n.slug,
    n.directory_level,
    n.full_name,
    n.coach_business_name,
    n.avatar_url,
    n.directory_summary,
    n.location,
    n.linkedin_url,
    n.total_count
  from numbered n, params
  order by
    case when params.is_browse then n.photo_rank else 0 end asc,
    case when params.is_browse then n.summary_rank else 0 end asc,
    n.full_name asc nulls last
  limit greatest(1, least(p_limit, 60))
  offset greatest(0, p_offset);
$$;

grant execute on function public.directory_coaches_page(text, text, text, int, int) to service_role;
