-- WhatsApp is a campaign channel, alongside LinkedIn and email.

alter table public.linkedin_campaigns
  drop constraint if exists linkedin_campaigns_channel_check;

alter table public.linkedin_campaigns
  add constraint linkedin_campaigns_channel_check
  check (channel in ('linkedin', 'email', 'whatsapp'));
