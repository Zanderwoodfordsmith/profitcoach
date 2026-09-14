-- One unique campaign pool per coach, plus smart-list views on that pool.

alter table public.coach_lead_lists
  drop constraint if exists coach_lead_lists_kind_check;

alter table public.coach_lead_lists
  add constraint coach_lead_lists_kind_check
  check (kind in ('audience', 'blacklist', 'pool'));

create unique index if not exists coach_lead_lists_one_pool_idx
  on public.coach_lead_lists (coach_id)
  where kind = 'pool';

insert into public.coach_lead_lists (
  coach_id, name, source, kind, filters
)
select distinct
  l.coach_id,
  'Pool',
  'mixed',
  'pool',
  '{"system": true}'::jsonb
from public.coach_lead_lists l
where l.kind = 'audience'
  and not exists (
    select 1
    from public.coach_lead_lists p
    where p.coach_id = l.coach_id
      and p.kind = 'pool'
  );

insert into public.coach_lead_list_items (
  list_id,
  coach_id,
  source,
  leadrocks_id,
  full_name,
  first_name,
  last_name,
  job_title,
  company,
  linkedin_url,
  email,
  phone,
  team_size,
  revenue_range,
  industry,
  match_reason,
  raw
)
select distinct on (pool.coach_id, i.linkedin_url)
  pool.id,
  i.coach_id,
  i.source,
  i.leadrocks_id,
  i.full_name,
  i.first_name,
  i.last_name,
  i.job_title,
  i.company,
  i.linkedin_url,
  i.email,
  i.phone,
  i.team_size,
  i.revenue_range,
  i.industry,
  i.match_reason,
  i.raw
from public.coach_lead_list_items i
join public.coach_lead_lists src
  on src.id = i.list_id
 and src.kind = 'audience'
join public.coach_lead_lists pool
  on pool.coach_id = i.coach_id
 and pool.kind = 'pool'
where i.linkedin_url is not null
  and btrim(i.linkedin_url) <> ''
  and not exists (
    select 1
    from public.coach_lead_list_items existing
    where existing.list_id = pool.id
      and existing.linkedin_url = i.linkedin_url
  )
order by pool.coach_id, i.linkedin_url, i.created_at asc;

update public.coach_lead_lists pool
set item_count = (
  select count(*)::int
  from public.coach_lead_list_items i
  where i.list_id = pool.id
),
    updated_at = now()
where pool.kind = 'pool';

alter table public.prospect_table_views
  drop constraint if exists prospect_table_views_surface_check;

alter table public.prospect_table_views
  add constraint prospect_table_views_surface_check
  check (surface in ('coach', 'admin', 'pool'));

alter table public.prospect_table_view_preferences
  drop constraint if exists prospect_table_view_preferences_surface_check;

alter table public.prospect_table_view_preferences
  add constraint prospect_table_view_preferences_surface_check
  check (surface in ('coach', 'admin', 'pool'));
