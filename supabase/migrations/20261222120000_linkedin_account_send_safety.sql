-- Account-level LinkedIn send safety: weekly budget, warm-up, send window,
-- and campaign priority/weight when multiple campaigns share one account.

alter table public.linkedin_outreach_accounts
  add column if not exists weekly_invite_target int not null default 100
    check (weekly_invite_target >= 20 and weekly_invite_target <= 200),
  add column if not exists daily_message_target int not null default 20
    check (daily_message_target >= 1 and daily_message_target <= 100),
  add column if not exists daily_react_target int not null default 12
    check (daily_react_target >= 1 and daily_react_target <= 100),
  add column if not exists min_action_delay_seconds int not null default 180
    check (min_action_delay_seconds >= 60 and min_action_delay_seconds <= 1800),
  add column if not exists max_action_delay_seconds int not null default 480
    check (max_action_delay_seconds >= 60 and max_action_delay_seconds <= 3600),
  add column if not exists timezone text not null default 'Europe/London',
  add column if not exists send_rules jsonb not null default '[
    {"weekday":1,"start_time":"07:00","end_time":"18:00"},
    {"weekday":2,"start_time":"07:00","end_time":"18:00"},
    {"weekday":3,"start_time":"07:00","end_time":"18:00"},
    {"weekday":4,"start_time":"07:00","end_time":"18:00"},
    {"weekday":5,"start_time":"07:00","end_time":"18:00"}
  ]'::jsonb,
  add column if not exists warmup_started_at timestamptz,
  add column if not exists invite_paused_until timestamptz,
  add column if not exists rate_limited_until timestamptz,
  add column if not exists daily_send_plan jsonb not null default '{}'::jsonb;

alter table public.linkedin_outreach_accounts
  drop constraint if exists linkedin_outreach_accounts_delay_order_check;

alter table public.linkedin_outreach_accounts
  add constraint linkedin_outreach_accounts_delay_order_check
  check (max_action_delay_seconds >= min_action_delay_seconds);

comment on column public.linkedin_outreach_accounts.weekly_invite_target is
  'Coach weekly invite ceiling (20-200). Effective cap also applies warm-up and daily mix.';
comment on column public.linkedin_outreach_accounts.daily_send_plan is
  'Cached plan for today: ymd, weekCap, quotas, assigned counts.';
comment on column public.linkedin_outreach_accounts.send_rules is
  'Account sending windows (0=Sun). Shared by all campaigns on this LinkedIn account.';

-- Seed warmup from earliest succeeded send job for that coach when possible.
update public.linkedin_outreach_accounts a
set warmup_started_at = sub.first_sent
from (
  select j.coach_id, min(j.updated_at) as first_sent
  from public.linkedin_send_jobs j
  where j.status = 'succeeded'
  group by j.coach_id
) sub
where a.coach_id = sub.coach_id
  and a.warmup_started_at is null
  and lower(coalesce(a.provider, 'LINKEDIN')) = 'linkedin';

-- Copy send window from a running campaign when present.
update public.linkedin_outreach_accounts a
set
  timezone = coalesce(nullif(trim(c.timezone), ''), a.timezone),
  send_rules = coalesce(c.send_rules, a.send_rules)
from (
  select distinct on (outreach_account_id)
    outreach_account_id,
    timezone,
    send_rules
  from public.linkedin_campaigns
  where outreach_account_id is not null
    and status in ('running', 'paused', 'draft')
  order by outreach_account_id, updated_at desc
) c
where a.id = c.outreach_account_id;

alter table public.linkedin_campaigns
  add column if not exists outreach_priority int not null default 100
    check (outreach_priority >= 1 and outreach_priority <= 10000),
  add column if not exists outreach_weight int not null default 1
    check (outreach_weight >= 1 and outreach_weight <= 20);

comment on column public.linkedin_campaigns.outreach_priority is
  'Lower runs first when campaigns compete for the account daily budget.';
comment on column public.linkedin_campaigns.outreach_weight is
  'Relative share of daily invite slots (1 = normal, 2 = double).';

-- Stable priority by creation order within each coach.
with ranked as (
  select
    id,
    row_number() over (partition by coach_id order by created_at asc, id asc) as rn
  from public.linkedin_campaigns
)
update public.linkedin_campaigns c
set outreach_priority = ranked.rn
from ranked
where c.id = ranked.id;
