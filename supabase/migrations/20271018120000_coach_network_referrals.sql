-- Referral network: each coach's LinkedIn connections (read through Unipile)
-- and the coach's own rating of each one ("we'd recognise each other's names").
-- Additive only. Server-side (service role); coaches reach it through
-- /api/coach/referrals, scoped by coach_id.
--
-- Another member only ever sees a connection this coach rated 'known', and only
-- when that person is already on the other member's campaign list.

create table if not exists public.coach_network_connections (
  coach_id uuid not null references public.coaches (id) on delete cascade,
  public_identifier text not null,
  member_id text,
  first_name text,
  last_name text,
  headline text,
  profile_url text,
  photo_url text,
  connected_at timestamptz,
  -- Accepted one of this coach's own campaign invites, so not a real relationship.
  from_campaign boolean not null default false,
  -- Owner, founder, CEO, MD, managing partner, chair (from the headline).
  decision_maker boolean not null default false,
  rating text check (rating in ('unknown', 'known')),
  rated_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (coach_id, public_identifier)
);

create index if not exists coach_network_connections_known_idx
  on public.coach_network_connections (public_identifier)
  where rating = 'known';

-- Matching a LinkedIn person across members' campaign lists.
create index if not exists linkedin_campaign_leads_public_identifier_idx
  on public.linkedin_campaign_leads ((metadata ->> 'public_identifier'), coach_id);

alter table public.coach_network_connections enable row level security;
revoke all on public.coach_network_connections from anon, authenticated;
grant all on public.coach_network_connections to service_role;

-- Next connections for the coach to rate. People already on another member's
-- campaign list come first (their rating can help someone now), then decision
-- makers, then the longest-standing connections.
create or replace function public.network_deck(p_coach_id uuid, p_limit int default 50)
returns table (
  public_identifier text,
  first_name text,
  last_name text,
  headline text,
  profile_url text,
  photo_url text,
  connected_at timestamptz,
  decision_maker boolean,
  on_other_lists int
)
language sql
stable
set search_path = public
as $$
  with mine as (
    select *
    from coach_network_connections
    where coach_id = p_coach_id
      and rating is null
      and not from_campaign
  ),
  wanted as (
    select l.metadata ->> 'public_identifier' as pid, count(distinct l.coach_id)::int as lists
    from linkedin_campaign_leads l
    join mine m on m.public_identifier = l.metadata ->> 'public_identifier'
    where l.coach_id <> p_coach_id
    group by 1
  )
  select
    m.public_identifier,
    m.first_name,
    m.last_name,
    m.headline,
    m.profile_url,
    m.photo_url,
    m.connected_at,
    m.decision_maker,
    coalesce(w.lists, 0) as on_other_lists
  from mine m
  left join wanted w on w.pid = m.public_identifier
  order by
    coalesce(w.lists, 0) > 0 desc,
    m.decision_maker desc,
    m.connected_at asc nulls last,
    m.public_identifier
  limit greatest(1, least(p_limit, 200));
$$;

-- People on this coach's campaign lists whom another member rated 'known'.
create or replace function public.referral_introducers(p_coach_id uuid)
returns table (
  introducer_id uuid,
  introducer_name text,
  introducer_avatar text,
  public_identifier text,
  first_name text,
  last_name text,
  headline text,
  profile_url text,
  photo_url text,
  lead_status text
)
language sql
stable
set search_path = public
as $$
  with mine as (
    select distinct on (l.metadata ->> 'public_identifier')
      l.metadata ->> 'public_identifier' as pid,
      l.status
    from linkedin_campaign_leads l
    where l.coach_id = p_coach_id
      and l.metadata ->> 'public_identifier' is not null
    order by l.metadata ->> 'public_identifier', l.updated_at desc
  )
  select
    n.coach_id,
    p.full_name,
    p.avatar_url,
    n.public_identifier,
    n.first_name,
    n.last_name,
    n.headline,
    n.profile_url,
    n.photo_url,
    mine.status
  from coach_network_connections n
  join mine on mine.pid = n.public_identifier
  join profiles p on p.id = n.coach_id
  where n.rating = 'known'
    and n.coach_id <> p_coach_id
  order by p.full_name, n.last_name, n.first_name;
$$;

revoke all on function public.network_deck(uuid, int) from public, anon, authenticated;
revoke all on function public.referral_introducers(uuid) from public, anon, authenticated;
grant execute on function public.network_deck(uuid, int) to service_role;
grant execute on function public.referral_introducers(uuid) to service_role;
