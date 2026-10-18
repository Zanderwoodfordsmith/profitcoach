-- Last counted size of each LinkedIn account's pending invite pile, so the
-- campaigns page can show it instantly instead of paging LinkedIn on every
-- visit (that took ~12s). Refreshed whenever the full list is paged.
alter table public.linkedin_outreach_accounts
  add column if not exists pending_invites_total integer,
  add column if not exists pending_invites_has_more boolean not null default false,
  add column if not exists pending_invites_counted_at timestamptz;
