-- Internal sequence actions: notify the coach, add the lead to another campaign.
alter table public.linkedin_campaign_steps
  drop constraint if exists linkedin_campaign_steps_step_type_check;

alter table public.linkedin_campaign_steps
  add constraint linkedin_campaign_steps_step_type_check
  check (
    step_type in (
      'invite',
      'message',
      'wait',
      'comment',
      'react',
      'visit',
      'email',
      'whatsapp',
      'notify',
      'add_to_campaign'
    )
  );

alter table public.linkedin_campaign_steps
  add column if not exists config jsonb not null default '{}'::jsonb;

comment on column public.linkedin_campaign_steps.config is
  'Per-step settings. notify: {in_app, email, whatsapp}. add_to_campaign: {campaign_id}.';
