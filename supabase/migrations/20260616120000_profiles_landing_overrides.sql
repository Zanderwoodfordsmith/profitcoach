-- Coach-editable landing copy (JSON allowlist in app) and optional A/B pin.
alter table profiles add column if not exists landing_copy_overrides jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists landing_variant_preference text;

alter table profiles drop constraint if exists profiles_landing_variant_preference_check;
alter table profiles add constraint profiles_landing_variant_preference_check
  check (landing_variant_preference is null or landing_variant_preference in ('a', 'b'));
