-- Sales Nav location for pool filters. Headcount already lives on team_size
-- but imports never copied it off the lead cache.

alter table public.coach_lead_list_items
  add column if not exists location text;

comment on column public.coach_lead_list_items.location is
  'LinkedIn location, e.g. Manchester, England, United Kingdom.';

update public.coach_lead_list_items as i
set
  team_size = coalesce(nullif(btrim(i.team_size), ''), l.team_size),
  industry = coalesce(nullif(btrim(i.industry), ''), l.industry),
  revenue_range = coalesce(nullif(btrim(i.revenue_range), ''), l.revenue_range),
  location = coalesce(nullif(btrim(i.location), ''), l.location)
from (
  select distinct on (linkedin_url)
    linkedin_url,
    team_size,
    industry,
    revenue_range,
    location
  from public.leadrocks_leads
  where linkedin_url is not null
    and btrim(linkedin_url) <> ''
  order by
    linkedin_url,
    (team_size is not null) desc,
    last_seen_at desc nulls last
) as l
where i.linkedin_url is not null
  and l.linkedin_url = rtrim(i.linkedin_url, '/');
