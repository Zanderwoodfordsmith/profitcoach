-- Coach lead webhook: admin-managed outbound URL fired when prospects submit contact info or finish the BOSS assessment.
-- Coaches do not see or edit this column; only admin endpoints read/write it.

alter table coaches
  add column if not exists lead_webhook_url text;

alter table coaches
  drop constraint if exists coaches_lead_webhook_url_format;

-- Cheap sanity check: only allow http/https URLs (or null). Per-row format errors should
-- surface to admin save, not silently corrupt the value.
alter table coaches
  add constraint coaches_lead_webhook_url_format
  check (
    lead_webhook_url is null
    or lead_webhook_url ~* '^https?://'
  );
