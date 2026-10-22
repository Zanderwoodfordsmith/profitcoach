-- Link each booking to the campaign lead it came from, so we can see which
-- campaigns turn into calls and measure days to first call and first client.
--
-- lead_match says how the link was made:
--   link    = booked through the lead's personal booking link (exact)
--   contact = the booking's contact is the lead's contact
--   name    = same name, same coach (past bookings and GoHighLevel)

alter table public.bookings
  add column if not exists campaign_lead_id uuid
    references public.linkedin_campaign_leads (id) on delete set null,
  add column if not exists lead_match text;

alter table public.ghl_appointments
  add column if not exists campaign_lead_id uuid
    references public.linkedin_campaign_leads (id) on delete set null,
  add column if not exists lead_match text;

alter table public.bookings drop constraint if exists bookings_lead_match_check;
alter table public.bookings
  add constraint bookings_lead_match_check
  check (lead_match is null or lead_match in ('link', 'contact', 'name'));

alter table public.ghl_appointments drop constraint if exists ghl_appointments_lead_match_check;
alter table public.ghl_appointments
  add constraint ghl_appointments_lead_match_check
  check (lead_match is null or lead_match in ('link', 'contact', 'name'));

create index if not exists bookings_campaign_lead_id_idx
  on public.bookings (campaign_lead_id) where campaign_lead_id is not null;
create index if not exists ghl_appointments_campaign_lead_id_idx
  on public.ghl_appointments (campaign_lead_id) where campaign_lead_id is not null;

-- Day 1 for "days to first call": when the coach's Stripe subscription started.
alter table public.coaches
  add column if not exists membership_started_at timestamptz;

comment on column public.coaches.membership_started_at is
  'When the coach''s Stripe subscription started (day 1 for days to first call and first client).';

-- First client: stamp the date a contact is marked client, unless one is set.
create or replace function public.contacts_stamp_client_joined()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'client'
     and new.client_joined_on is null
     and (tg_op = 'INSERT' or old.type is distinct from 'client') then
    new.client_joined_on := current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists contacts_stamp_client_joined on public.contacts;
create trigger contacts_stamp_client_joined
  before insert or update of type on public.contacts
  for each row execute function public.contacts_stamp_client_joined();
