-- Former staff (Mark James, Zac Fagan): revoke product access while keeping
-- profiles so community post/comment authorship still shows their name + avatar.
-- Login ban is applied via auth admin API (see scripts/deactivate-former-staff.ts).

update public.coaches
set
  access_tier = 'early_exit',
  access_tier_locked = true
where id in (
  '9fa4ceb3-7605-42e2-b9a8-dd923814eac3', -- Mark James
  '4713d7f7-5733-4fcb-8559-4ad3befacffb'  -- Zac Fagan
);
