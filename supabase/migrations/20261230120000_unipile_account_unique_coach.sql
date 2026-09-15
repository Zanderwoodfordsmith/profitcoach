-- One Unipile account (Google / Outlook / LinkedIn) may belong to only one coach.
-- Duplicate rows: keep the oldest, drop the rest.

with ranked as (
  select
    id,
    row_number() over (
      partition by unipile_account_id
      order by created_at asc, id asc
    ) as rn
  from public.linkedin_outreach_accounts
  where unipile_account_id is not null
    and btrim(unipile_account_id) <> ''
)
delete from public.linkedin_outreach_accounts a
using ranked r
where a.id = r.id
  and r.rn > 1;

create unique index if not exists linkedin_outreach_accounts_unipile_account_uidx
  on public.linkedin_outreach_accounts (unipile_account_id);

-- Drop calendar prefs that point at an account this coach no longer owns.
delete from public.coach_unipile_calendar_prefs p
where not exists (
  select 1
  from public.linkedin_outreach_accounts a
  where a.coach_id = p.coach_id
    and a.unipile_account_id = p.unipile_account_id
);
