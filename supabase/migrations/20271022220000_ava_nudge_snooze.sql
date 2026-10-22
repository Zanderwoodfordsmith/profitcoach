-- Coaches (or BCA for them) can pause Ava's nudges until a date.
alter table public.coach_ava_settings
  add column if not exists nudges_snoozed_until timestamptz;

comment on column public.coach_ava_settings.nudges_snoozed_until is
  'No Ava nudges for this coach until this time (set by the coach or BCA).';
