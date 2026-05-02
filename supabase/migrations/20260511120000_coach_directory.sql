-- Public coach directory: visibility + admin-assigned tier

alter table coaches
  add column if not exists directory_listed boolean not null default false;

alter table coaches
  add column if not exists directory_level text;

-- Allow null (no badge yet) or one of three tiers
alter table coaches
  drop constraint if exists coaches_directory_level_check;

alter table coaches
  add constraint coaches_directory_level_check
  check (directory_level is null or directory_level in ('certified', 'professional', 'elite'));

create index if not exists coaches_directory_listed_idx
  on coaches (directory_listed)
  where directory_listed = true;

-- Paginated public directory listing (called from Next.js API with service role only)
create or replace function public.directory_coaches_page(
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
  bio text,
  location text,
  linkedin_url text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      c.slug,
      c.directory_level,
      p.full_name,
      p.coach_business_name,
      p.avatar_url,
      p.bio,
      p.location,
      p.linkedin_url
    from coaches c
    inner join profiles p on p.id = c.id
    where c.directory_listed = true
      and (p_level is null or btrim(p_level) = '' or c.directory_level = p_level)
      and (p_location is null or btrim(p_location) = '' or p.location ilike '%' || p_location || '%')
      and (
        p_search is null or btrim(p_search) = ''
        or p.full_name ilike '%' || p_search || '%'
        or coalesce(p.coach_business_name, '') ilike '%' || p_search || '%'
        or coalesce(p.bio, '') ilike '%' || p_search || '%'
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
    n.bio,
    n.location,
    n.linkedin_url,
    n.total_count
  from numbered n
  order by n.full_name asc nulls last
  limit greatest(1, least(p_limit, 48))
  offset greatest(0, p_offset);
$$;

grant execute on function public.directory_coaches_page(text, text, text, int, int) to service_role;
