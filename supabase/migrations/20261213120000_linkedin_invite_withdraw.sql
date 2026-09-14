-- Per-account policy for withdrawing pending LinkedIn connection requests.
-- Default off: auto-withdraw is destructive and must be opted in.

alter table public.linkedin_outreach_accounts
  add column if not exists invite_withdraw_mode text not null default 'off'
    check (invite_withdraw_mode in ('off', 'daily', 'cap', 'age')),
  add column if not exists invite_withdraw_value int not null default 20
    check (invite_withdraw_value > 0 and invite_withdraw_value <= 800),
  add column if not exists invite_withdraw_ran_on date,
  add column if not exists invite_withdraw_ran_count int not null default 0
    check (invite_withdraw_ran_count >= 0);

create index if not exists linkedin_outreach_accounts_withdraw_idx
  on public.linkedin_outreach_accounts (status, invite_withdraw_mode)
  where invite_withdraw_mode <> 'off';
