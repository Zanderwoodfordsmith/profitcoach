alter table public.coaches
add column if not exists crm_profile_name text,
add column if not exists crm_location_id text;

comment on column public.coaches.crm_profile_name is
  'CRM account/profile display name (e.g. AMF Consulting).';

comment on column public.coaches.crm_location_id is
  'CRM location identifier appended to https://app.procoachplatform.com/v2/location/<id>.';
