-- Jobs 300 and 301: Lead Lists can filter by status (Invited, Connected,
-- Replied) and by how long ago, e.g. "Connected for more than 90 days".
-- A lead's status moves on after each step (connected → in_sequence), so the
-- date each step happened is kept in its own column and never overwritten.
-- Additive only.

alter table public.linkedin_campaign_leads
  add column if not exists invited_at timestamptz,
  add column if not exists connected_at timestamptz,
  add column if not exists replied_at timestamptz;

create or replace function public.linkedin_campaign_leads_stamp_status_dates()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'invited' and new.invited_at is null then
      new.invited_at := now();
    elsif new.status = 'connected' and new.connected_at is null then
      new.connected_at := now();
    elsif new.status = 'replied' and new.replied_at is null then
      new.replied_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_linkedin_campaign_leads_status_dates
  on public.linkedin_campaign_leads;
create trigger trg_linkedin_campaign_leads_status_dates
  before insert or update of status on public.linkedin_campaign_leads
  for each row execute function public.linkedin_campaign_leads_stamp_status_dates();

-- Best guesses for leads already past a step. Exact connection dates come
-- from the coach's LinkedIn connections (coach_network_connections), synced
-- by /api/cron/linkedin-connections-sync. Leave updated_at alone while filling.
alter table public.linkedin_campaign_leads
  disable trigger trg_linkedin_campaign_leads_updated_at;

update public.linkedin_campaign_leads l
set invited_at = sent.at
from (
  select j.lead_id, min(j.updated_at) as at
  from public.linkedin_send_jobs j
  join public.linkedin_campaign_steps s on s.id = j.step_id
  where s.step_type = 'invite'
    and j.status = 'succeeded'
    and j.lead_id is not null
  group by j.lead_id
) sent
where sent.lead_id = l.id
  and l.invited_at is null;

-- Pending invites with no send job came across from Sales Robot: the invite
-- went out on or before the day the lead was added.
update public.linkedin_campaign_leads
set invited_at = created_at
where status = 'invited' and invited_at is null;

update public.linkedin_campaign_leads
set connected_at = updated_at
where status = 'connected' and connected_at is null;

update public.linkedin_campaign_leads
set replied_at = updated_at
where status = 'replied' and replied_at is null;

alter table public.linkedin_campaign_leads
  enable trigger trg_linkedin_campaign_leads_updated_at;

-- When each coach's LinkedIn connections were last read (daily refresh).
alter table public.linkedin_outreach_accounts
  add column if not exists network_synced_at timestamptz;
