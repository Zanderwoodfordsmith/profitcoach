-- Allow landing funnel variant C (long-form marketing page) in events and coach defaults.

alter table landing_events drop constraint if exists landing_events_variant_check;
alter table landing_events
  add constraint landing_events_variant_check check (variant in ('a', 'b', 'c'));

alter table profiles drop constraint if exists profiles_landing_variant_preference_check;
alter table profiles
  add constraint profiles_landing_variant_preference_check
  check (landing_variant_preference is null or landing_variant_preference in ('a', 'b', 'c'));
