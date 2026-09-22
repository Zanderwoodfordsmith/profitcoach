-- Remember starter playbooks a coach hard-deleted so ensureDefaultCampaigns
-- does not resurrect them on the next campaigns list load.
alter table public.coaches
  add column if not exists dismissed_campaign_playbooks text[] not null default '{}'::text[];

comment on column public.coaches.dismissed_campaign_playbooks is
  'source_playbook_id values the coach deleted; do not auto-recreate those defaults.';
