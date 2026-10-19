-- Admin Referrals (Tools and links): which coaches have a LinkedIn network loaded,
-- and how many of their connections they have rated 'known'. Additive only.

create or replace function public.referral_network_coaches()
returns table (coach_id uuid, total int, known int)
language sql
stable
set search_path = public
as $$
  select
    coach_id,
    count(*) filter (where not from_campaign)::int as total,
    count(*) filter (where rating = 'known')::int as known
  from coach_network_connections
  group by coach_id;
$$;

revoke all on function public.referral_network_coaches() from public, anon, authenticated;
grant execute on function public.referral_network_coaches() to service_role;
