-- Hybrid campaign steps: auto send vs coach-remind (+ optional fallback auto).

alter table public.linkedin_campaign_steps
  add column if not exists send_mode text not null default 'auto',
  add column if not exists fallback_hours numeric(10, 2),
  add column if not exists fallback_body text;

alter table public.linkedin_campaign_steps
  drop constraint if exists linkedin_campaign_steps_send_mode_check;

alter table public.linkedin_campaign_steps
  add constraint linkedin_campaign_steps_send_mode_check
  check (send_mode in ('auto', 'remind'));

comment on column public.linkedin_campaign_steps.send_mode is
  'auto = worker sends; remind = surfaces in coach due queue until send/skip/fallback';

comment on column public.linkedin_campaign_steps.fallback_hours is
  'Hours after scheduled_for when an unsent remind step auto-sends fallback_body (or body). Null = no fallback.';

comment on column public.linkedin_campaign_steps.fallback_body is
  'Template used for auto fallback when coach misses a remind step. Falls back to body if null.';

alter table public.linkedin_send_jobs
  drop constraint if exists linkedin_send_jobs_status_check;

alter table public.linkedin_send_jobs
  add constraint linkedin_send_jobs_status_check
  check (status in (
    'pending',
    'running',
    'awaiting_coach',
    'succeeded',
    'failed',
    'cancelled'
  ));

alter table public.linkedin_send_jobs
  add column if not exists draft_body text,
  add column if not exists sent_by text;

alter table public.linkedin_send_jobs
  drop constraint if exists linkedin_send_jobs_sent_by_check;

alter table public.linkedin_send_jobs
  add constraint linkedin_send_jobs_sent_by_check
  check (sent_by is null or sent_by in ('worker', 'coach', 'fallback'));

create index if not exists linkedin_send_jobs_awaiting_coach_idx
  on public.linkedin_send_jobs (coach_id, status, scheduled_for)
  where status = 'awaiting_coach';
