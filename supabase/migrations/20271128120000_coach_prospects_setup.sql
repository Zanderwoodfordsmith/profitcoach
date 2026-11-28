-- Prospects set up at launch (28 Nov 2026): connections are imported once,
-- and a coach can choose not to use their network for referrals for now.
alter table public.coaches
  add column if not exists connections_imported_at timestamptz,
  add column if not exists referral_off boolean not null default false;
