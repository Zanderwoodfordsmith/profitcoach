-- Extra sequence actions: profile visit, email, WhatsApp
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
      'whatsapp'
    )
  );
