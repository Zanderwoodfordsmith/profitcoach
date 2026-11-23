-- Unique people across each coach's lead lists (23 Nov), counted in the
-- database so the Launch view and Getting live don't download every list item
-- to count them. The same person on two lists counts once. Same key as before
-- in src/lib/gettingLive.ts: their LinkedIn address (lower case, without
-- http(s):// or www. and trailing slashes), else their name and company.
create or replace function public.lead_list_unique_people(p_coach_ids uuid[])
returns table (coach_id uuid, people integer)
language sql
stable
set search_path = public
as $fn$
  select k.coach_id, count(distinct k.key)::integer
  from (
    select
      i.coach_id,
      coalesce(
        nullif(regexp_replace(regexp_replace(lower(btrim(i.linkedin_url)), '^https?://(www\.)?', ''), '/+$', ''), ''),
        case when n.name <> '' then n.name || '|' || lower(btrim(coalesce(i.company, ''))) end
      ) as key
    from public.coach_lead_list_items i
    cross join lateral (
      select lower(btrim(coalesce(nullif(i.full_name, ''), concat_ws(' ', nullif(i.first_name, ''), nullif(i.last_name, ''))))) as name
    ) n
    where i.coach_id = any(p_coach_ids)
  ) k
  where k.key is not null
  group by k.coach_id;
$fn$;

revoke all on function public.lead_list_unique_people(uuid[]) from public;
revoke all on function public.lead_list_unique_people(uuid[]) from anon, authenticated;
grant execute on function public.lead_list_unique_people(uuid[]) to service_role;
