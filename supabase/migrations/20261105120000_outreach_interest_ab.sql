-- Interest-first funnel + A/B variants on sequence steps.

alter table public.linkedin_campaign_leads
  drop constraint if exists linkedin_campaign_leads_status_check;

alter table public.linkedin_campaign_leads
  add constraint linkedin_campaign_leads_status_check
  check (
    status in (
      'queued',
      'invited',
      'connected',
      'in_sequence',
      'replied',
      'interested',
      'assessment_sent',
      'assessment_done',
      'call_offered',
      'completed',
      'failed',
      'paused',
      'skipped'
    )
  );

alter table public.linkedin_campaign_leads
  add column if not exists interest_outcome text
    check (
      interest_outcome is null
      or interest_outcome in ('positive', 'soft', 'negative', 'unclear')
    ),
  add column if not exists interest_note text,
  add column if not exists interest_logged_at timestamptz,
  add column if not exists ab_assignments jsonb not null default '{}'::jsonb,
  add column if not exists funnel_events jsonb not null default '[]'::jsonb;

alter table public.linkedin_campaign_steps
  add column if not exists variants jsonb not null default '[]'::jsonb;

comment on column public.linkedin_campaign_steps.variants is
  'Optional A/B bodies: [{ "key": "A", "label": "...", "body": "..." }]';
comment on column public.linkedin_campaign_leads.ab_assignments is
  'Map of step_id → variant key chosen for this lead';
