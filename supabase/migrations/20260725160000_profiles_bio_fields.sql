-- Split profile copy by surface: community roster vs public directory listing/detail.

alter table public.profiles add column if not exists community_bio text;
alter table public.profiles add column if not exists directory_summary text;
alter table public.profiles add column if not exists directory_bio text;

comment on column public.profiles.community_bio is
  'Bio shown in the internal community roster, hover cards, and members map.';
comment on column public.profiles.directory_summary is
  'Short summary shown on public directory and attendees listing cards.';
comment on column public.profiles.directory_bio is
  'Longer bio shown on the public directory profile page.';

-- Seed directory summary from legacy bio so existing coaches keep their listing copy.
update public.profiles
set directory_summary = bio
where bio is not null
  and btrim(bio) <> ''
  and (directory_summary is null or btrim(directory_summary) = '');

-- Long legacy bios become the detailed directory version (summary still holds full text for cards/search).
update public.profiles
set directory_bio = bio
where bio is not null
  and btrim(bio) <> ''
  and length(btrim(bio)) > 250
  and (directory_bio is null or btrim(directory_bio) = '');

-- Return column renamed bio → directory_summary; must drop before recreate.
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
  with filtered as (
    select
      c.slug,
      c.directory_level,
      p.full_name,
      p.coach_business_name,
      p.avatar_url,
      coalesce(nullif(btrim(p.directory_summary), ''), p.bio) as directory_summary,
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
  from numbered n
  order by n.full_name asc nulls last
  limit greatest(1, least(p_limit, 48))
  offset greatest(0, p_offset);
$$;

grant execute on function public.directory_coaches_page(text, text, text, int, int) to service_role;

drop function if exists public.conference_attendees_page(text, text, int, int);

create function public.conference_attendees_page(
  p_search text,
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
  with filtered as (
    select
      c.slug,
      c.directory_level,
      p.full_name,
      p.coach_business_name,
      p.avatar_url,
      coalesce(nullif(btrim(p.directory_summary), ''), p.bio) as directory_summary,
      p.location,
      p.linkedin_url
    from coaches c
    inner join profiles p on p.id = c.id
    where c.conference_status = 'yes'
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
  from numbered n
  order by n.full_name asc nulls last
  limit greatest(1, least(p_limit, 48))
  offset greatest(0, p_offset);
$$;

grant execute on function public.conference_attendees_page(text, text, int, int) to service_role;

create or replace function public.community_members_map()
returns table (
  coach_id uuid,
  slug text,
  full_name text,
  coach_business_name text,
  avatar_url text,
  bio text,
  location text,
  latitude double precision,
  longitude double precision,
  directory_listed boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id as coach_id,
    c.slug,
    p.full_name,
    p.coach_business_name,
    p.avatar_url,
    coalesce(nullif(btrim(p.community_bio), ''), p.bio) as bio,
    p.location,
    p.latitude,
    p.longitude,
    coalesce(c.directory_listed, false) as directory_listed
  from profiles p
  left join coaches c on c.id = p.id
  where p.role in ('coach', 'admin')
    and p.latitude is not null
    and p.longitude is not null;
$$;

grant execute on function public.community_members_map() to authenticated;
grant execute on function public.community_members_map() to service_role;
