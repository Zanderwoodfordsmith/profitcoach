-- Atomic campaign step replace.
-- The previous JS path deleted every step then inserted, which:
-- 1. raced with a second save (A/B toggle blurs the editor and commits twice)
--    and hit linkedin_campaign_steps_campaign_id_position_key
-- 2. minted new step ids, wiping A/B assignments and cascading send jobs.

create or replace function public.replace_linkedin_campaign_steps(
  p_campaign_id uuid,
  p_steps jsonb
)
returns setof public.linkedin_campaign_steps
language plpgsql
security definer
set search_path = public
as $fn$
declare
  pos_offset constant int := 1000000;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    raise exception 'steps must be a json array';
  end if;

  perform 1
  from public.linkedin_campaigns
  where id = p_campaign_id
  for update;
  if not found then
    raise exception 'Campaign not found';
  end if;

  update public.linkedin_campaign_steps
  set position = position + pos_offset
  where campaign_id = p_campaign_id;

  update public.linkedin_campaign_steps s
  set
    position = p.position,
    step_type = p.step_type,
    body = p.body,
    wait_hours = p.wait_hours,
    variants = coalesce(p.variants, '[]'::jsonb),
    send_mode = p.send_mode,
    fallback_hours = p.fallback_hours,
    fallback_body = p.fallback_body,
    config = coalesce(p.config, '{}'::jsonb),
    updated_at = now()
  from (
    select
      case
        when (elem->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (elem->>'id')::uuid
        else null
      end as id,
      coalesce((elem->>'position')::int, (ord - 1)::int) as position,
      elem->>'step_type' as step_type,
      elem->>'body' as body,
      case
        when elem->>'wait_hours' is null or elem->>'wait_hours' = '' then null
        else (elem->>'wait_hours')::numeric
      end as wait_hours,
      case
        when jsonb_typeof(elem->'variants') = 'array' then elem->'variants'
        else '[]'::jsonb
      end as variants,
      case
        when elem->>'send_mode' = 'remind' then 'remind'
        else 'auto'
      end as send_mode,
      case
        when elem->>'fallback_hours' is null or elem->>'fallback_hours' = '' then null
        else (elem->>'fallback_hours')::numeric
      end as fallback_hours,
      elem->>'fallback_body' as fallback_body,
      case
        when jsonb_typeof(elem->'config') = 'object' then elem->'config'
        else '{}'::jsonb
      end as config
    from jsonb_array_elements(p_steps) with ordinality as t(elem, ord)
  ) p
  where s.id = p.id
    and s.campaign_id = p_campaign_id
    and p.id is not null;

  insert into public.linkedin_campaign_steps (
    campaign_id,
    position,
    step_type,
    body,
    wait_hours,
    variants,
    send_mode,
    fallback_hours,
    fallback_body,
    config
  )
  select
    p_campaign_id,
    p.position,
    p.step_type,
    p.body,
    p.wait_hours,
    p.variants,
    p.send_mode,
    p.fallback_hours,
    p.fallback_body,
    p.config
  from (
    select
      case
        when (elem->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (elem->>'id')::uuid
        else null
      end as id,
      coalesce((elem->>'position')::int, (ord - 1)::int) as position,
      elem->>'step_type' as step_type,
      elem->>'body' as body,
      case
        when elem->>'wait_hours' is null or elem->>'wait_hours' = '' then null
        else (elem->>'wait_hours')::numeric
      end as wait_hours,
      case
        when jsonb_typeof(elem->'variants') = 'array' then elem->'variants'
        else '[]'::jsonb
      end as variants,
      case
        when elem->>'send_mode' = 'remind' then 'remind'
        else 'auto'
      end as send_mode,
      case
        when elem->>'fallback_hours' is null or elem->>'fallback_hours' = '' then null
        else (elem->>'fallback_hours')::numeric
      end as fallback_hours,
      elem->>'fallback_body' as fallback_body,
      case
        when jsonb_typeof(elem->'config') = 'object' then elem->'config'
        else '{}'::jsonb
      end as config
    from jsonb_array_elements(p_steps) with ordinality as t(elem, ord)
  ) p
  where p.id is null
     or not exists (
       select 1
       from public.linkedin_campaign_steps s
       where s.id = p.id
         and s.campaign_id = p_campaign_id
     );

  delete from public.linkedin_campaign_steps
  where campaign_id = p_campaign_id
    and position >= pos_offset;

  return query
  select *
  from public.linkedin_campaign_steps
  where campaign_id = p_campaign_id
  order by position;
end;
$fn$;

comment on function public.replace_linkedin_campaign_steps(uuid, jsonb) is
  'Replace a campaign sequence in one transaction. Locks the campaign row, preserves step ids, and avoids (campaign_id, position) races.';

revoke all on function public.replace_linkedin_campaign_steps(uuid, jsonb) from public;
grant execute on function public.replace_linkedin_campaign_steps(uuid, jsonb) to service_role;
