-- Fix landing analytics: allow variant D (/score default) and nullable test_id.
-- Safe to re-run.

alter table landing_events drop constraint if exists landing_events_variant_check;
alter table landing_events
  add constraint landing_events_variant_check check (variant in ('a', 'b', 'c', 'd'));

alter table landing_events alter column test_id drop not null;

alter table profiles drop constraint if exists profiles_landing_variant_preference_check;
alter table profiles
  add constraint profiles_landing_variant_preference_check
  check (landing_variant_preference is null or landing_variant_preference in ('a', 'b', 'c', 'd'));
