-- Starter campaigns per coach: channel + which playbook seeded the row.
-- Email sequences are stored as editable drafts; LinkedIn send stays on channel = linkedin.

alter table public.linkedin_campaigns
  add column if not exists channel text not null default 'linkedin',
  add column if not exists source_playbook_id text;

alter table public.linkedin_campaigns
  drop constraint if exists linkedin_campaigns_channel_check;

alter table public.linkedin_campaigns
  add constraint linkedin_campaigns_channel_check
  check (channel in ('linkedin', 'email'));

create unique index if not exists linkedin_campaigns_coach_source_playbook_uidx
  on public.linkedin_campaigns (coach_id, source_playbook_id)
  where source_playbook_id is not null;
