-- Members map: cache geocoded lat/lng on profiles + RPC to feed the community map view.
-- See: src/lib/geocodeLocation.ts (Nominatim) and src/app/api/community/members-map/route.ts

alter table profiles add column if not exists latitude double precision;
alter table profiles add column if not exists longitude double precision;
alter table profiles add column if not exists location_geocoded_at timestamptz;
alter table profiles add column if not exists location_geocoded_source text;

alter table profiles
  drop constraint if exists profiles_location_geocoded_source_check;
alter table profiles
  add constraint profiles_location_geocoded_source_check
  check (location_geocoded_source is null or location_geocoded_source in ('nominatim', 'manual'));

create index if not exists profiles_lat_lng_idx
  on profiles (latitude, longitude)
  where latitude is not null and longitude is not null;

-- Coaches/admins with non-null coords. Joined to coaches so we can surface slug
-- and the public-directory opt-in (controls whether the popup shows a profile link).
-- security invoker keeps this gated by existing community RLS on profiles/coaches.
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
    p.bio,
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
