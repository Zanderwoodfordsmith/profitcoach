-- Pending-invite auto-clean on by default: keep under 600.
alter table public.linkedin_outreach_accounts
  alter column invite_withdraw_mode set default 'cap',
  alter column invite_withdraw_value set default 600;

-- Existing connected accounts that never opted in → product default on.
update public.linkedin_outreach_accounts
set
  invite_withdraw_mode = 'cap',
  invite_withdraw_value = 600
where invite_withdraw_mode = 'off';
