-- Open Profile on campaign leads so connector steps can InMail instead of invite.

alter table public.linkedin_campaign_leads
  add column if not exists open_profile boolean;

comment on column public.linkedin_campaign_leads.open_profile is
  'LinkedIn Open Profile. When true, the connector step can send a free InMail instead of a connection request.';

create index if not exists linkedin_campaign_leads_open_profile_idx
  on public.linkedin_campaign_leads (open_profile)
  where open_profile is true;
