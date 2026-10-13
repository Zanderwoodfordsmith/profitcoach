-- Keep Sales Navigator's own order on imported people.
-- Sales Nav returns people by relevance (recently active people rank higher).
-- We used to drop that order, so the pool fell back to A-Z by name and
-- campaigns enrolled the alphabet rather than the best matches.
--
-- source_rank: 0 = best match within that import.
-- source_ranked_at: when that import landed, so newer imports sort first.

alter table public.coach_lead_list_items
  add column if not exists source_rank integer,
  add column if not exists source_ranked_at timestamptz;

-- Stamp ranks for one list in a single call. p_identity_keys is in rank order.
create or replace function public.stamp_lead_list_item_ranks(
  p_list_id uuid,
  p_identity_keys text[],
  p_ranked_at timestamptz,
  p_rank_offset integer default 0
)
returns integer
language sql
security definer
set search_path = public
as $fn$
  with ranked as (
    select key, (ord - 1 + p_rank_offset)::integer as rank
    from unnest(p_identity_keys) with ordinality as t(key, ord)
  ),
  updated as (
    update public.coach_lead_list_items i
    set source_rank = ranked.rank,
        source_ranked_at = p_ranked_at
    from ranked
    where i.list_id = p_list_id
      and i.identity_key = ranked.key
    returning 1
  )
  select count(*)::integer from updated;
$fn$;

revoke all on function public.stamp_lead_list_item_ranks(uuid, text[], timestamptz, integer) from public;
revoke all on function public.stamp_lead_list_item_ranks(uuid, text[], timestamptz, integer) from anon, authenticated;
grant execute on function public.stamp_lead_list_item_ranks(uuid, text[], timestamptz, integer) to service_role;
