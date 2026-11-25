-- Campaign list speed (job 292): count leads per campaign by status and reply
-- outcome in the database, instead of the app downloading every lead row.
create or replace function public.campaign_lead_counts(p_campaign_ids uuid[])
returns table (
  campaign_id uuid,
  status text,
  interest_outcome text,
  n bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select l.campaign_id, l.status::text, l.interest_outcome::text, count(*)::bigint as n
  from public.linkedin_campaign_leads l
  where l.campaign_id = any(p_campaign_ids)
  group by l.campaign_id, l.status, l.interest_outcome
  order by 1, 2, 3;
$$;

-- Server only: the app calls this with the service role after checking the coach.
revoke all on function public.campaign_lead_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.campaign_lead_counts(uuid[]) to service_role;

notify pgrst, 'reload schema';
