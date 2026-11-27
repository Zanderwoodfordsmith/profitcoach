-- Templates remember their channel, so a coach can save Email and WhatsApp
-- campaigns too (job 297). BCA's library rows stay LinkedIn.

alter table public.campaign_library_items
  add column if not exists channel text not null default 'linkedin'
    check (channel in ('linkedin', 'email', 'whatsapp'));
