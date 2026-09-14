-- Raise daily invite cap and add message/like limits plus sending hours.

alter table public.linkedin_campaigns
  drop constraint if exists linkedin_campaigns_daily_invite_limit_check;

alter table public.linkedin_campaigns
  add constraint linkedin_campaigns_daily_invite_limit_check
  check (daily_invite_limit > 0 and daily_invite_limit <= 250);

alter table public.linkedin_campaigns
  add column if not exists daily_message_limit int not null default 20;

alter table public.linkedin_campaigns
  drop constraint if exists linkedin_campaigns_daily_message_limit_check;

alter table public.linkedin_campaigns
  add constraint linkedin_campaigns_daily_message_limit_check
  check (daily_message_limit > 0 and daily_message_limit <= 100);

alter table public.linkedin_campaigns
  add column if not exists daily_react_limit int not null default 20;

alter table public.linkedin_campaigns
  drop constraint if exists linkedin_campaigns_daily_react_limit_check;

alter table public.linkedin_campaigns
  add constraint linkedin_campaigns_daily_react_limit_check
  check (daily_react_limit > 0 and daily_react_limit <= 100);

alter table public.linkedin_campaigns
  add column if not exists send_rules jsonb not null default '[
    {"weekday":1,"start_time":"07:00","end_time":"18:00"},
    {"weekday":2,"start_time":"07:00","end_time":"18:00"},
    {"weekday":3,"start_time":"07:00","end_time":"18:00"},
    {"weekday":4,"start_time":"07:00","end_time":"18:00"},
    {"weekday":5,"start_time":"07:00","end_time":"18:00"}
  ]'::jsonb;

comment on column public.linkedin_campaigns.send_rules is
  'Weekday sending windows (0=Sun). Default Mon–Fri 07:00–18:00 in campaign timezone.';
