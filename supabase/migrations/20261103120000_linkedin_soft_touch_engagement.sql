-- Soft-touch sequence steps + wider step_type check
alter table public.linkedin_campaign_steps
  drop constraint if exists linkedin_campaign_steps_step_type_check;

alter table public.linkedin_campaign_steps
  add constraint linkedin_campaign_steps_step_type_check
  check (step_type in ('invite', 'message', 'wait', 'comment', 'react'));

-- Optional engagement snapshot on published content posts
alter table public.linkedin_scheduled_posts
  add column if not exists engagement jsonb not null default '{}'::jsonb,
  add column if not exists engagement_synced_at timestamptz;
