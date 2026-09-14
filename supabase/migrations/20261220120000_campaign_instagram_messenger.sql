-- Instagram + Facebook Messenger campaign steps, and prospect profile URLs.

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
      'instagram',
      'instagram_react',
      'instagram_comment',
      'instagram_follow',
      'messenger',
      'notify',
      'add_to_campaign',
      'call'
    )
  );

alter table public.contacts
  add column if not exists instagram_url text,
  add column if not exists facebook_url text;

comment on column public.contacts.instagram_url is
  'Canonical Instagram profile URL used for Unipile DMs, likes, comments, and follows.';

comment on column public.contacts.facebook_url is
  'Canonical Facebook profile URL used for Unipile Messenger sends.';
