-- Facilitated Ideal Client: Profile must be locked before Avatar generate.
alter table public.coach_icps
  add column if not exists profile_locked_at timestamptz;

comment on column public.coach_icps.profile_locked_at is
  'When set, the coach confirmed/edited Ideal Client Profile; Avatar must be generated from this locked profile.';
