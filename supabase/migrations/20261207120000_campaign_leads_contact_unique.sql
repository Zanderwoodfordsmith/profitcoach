-- One campaign enrollment per contact (when the lead is tied to a contact).
delete from public.linkedin_campaign_leads a
using public.linkedin_campaign_leads b
where a.contact_id is not null
  and a.campaign_id = b.campaign_id
  and a.contact_id = b.contact_id
  and a.id > b.id;

create unique index if not exists linkedin_campaign_leads_campaign_contact_uidx
  on public.linkedin_campaign_leads (campaign_id, contact_id)
  where contact_id is not null;
